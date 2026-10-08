import json
from urllib.parse import parse_qs

from asgiref.sync import sync_to_async
from channels.db import database_sync_to_async
from channels.generic.websocket import AsyncJsonWebsocketConsumer
from django.contrib.auth import get_user_model
from django.contrib.auth.models import AnonymousUser
from django.utils import timezone
from rest_framework_simplejwt.tokens import AccessToken

from .models import Chat, Message, MessageStatus, Reaction
from .tasks import notify_new_message

User = get_user_model()


class JWTAuthMiddleware:
    def __init__(self, inner):
        self.inner = inner

    def __call__(self, scope):
        return JWTAuthMiddlewareInstance(scope, self)


class JWTAuthMiddlewareInstance:
    def __init__(self, scope, middleware):
        self.scope = dict(scope)
        self.inner = middleware.inner

    async def __call__(self, receive, send):
        query_string = self.scope.get('query_string', b'').decode()
        query_params = parse_qs(query_string)
        token = query_params.get('token', [None])[0]
        self.scope['user'] = AnonymousUser()

        if token:
            try:
                access_token = AccessToken(token)
                self.scope['user'] = await database_sync_to_async(User.objects.get)(id=access_token['user_id'])
            except Exception:
                self.scope['user'] = AnonymousUser()

        inner = self.inner(self.scope)
        return await inner(receive, send)


@database_sync_to_async
def get_chat(chat_id):
    return Chat.objects.filter(id=chat_id).first()


@database_sync_to_async
def is_chat_member(chat_id, user_id):
    return Chat.objects.filter(id=chat_id, participants__id=user_id).exists()


@database_sync_to_async
def create_message(chat_id, user, content):
    message = Message.objects.create(chat_id=chat_id, sender=user, content=content)
    MessageStatus.objects.create(message=message, user=user, delivered=True, read=True)
    MessageStatus.objects.bulk_create([
        MessageStatus(message=message, user=participant, delivered=False, read=False)
        for participant in message.chat.participants.exclude(pk=user.pk)
    ])
    return message


@database_sync_to_async
def set_user_online(user, online=True):
    if user.is_authenticated:
        user.online = online
        user.save(update_fields=['online'])


@database_sync_to_async
def add_reaction(message_id, user, emoji):
    message = Message.objects.get(pk=message_id)
    reaction, created = Reaction.objects.get_or_create(message=message, user=user, emoji=emoji)
    return reaction, created


@database_sync_to_async
def remove_reaction(message_id, user, emoji):
    Reaction.objects.filter(message_id=message_id, user=user, emoji=emoji).delete()


@database_sync_to_async
def mark_message_read(message_id, user):
    status, created = MessageStatus.objects.get_or_create(message_id=message_id, user=user)
    status.read = True
    status.read_at = timezone.now()
    status.delivered = True
    if not status.delivered_at:
        status.delivered_at = timezone.now()
    status.save()
    return status


class ChatConsumer(AsyncJsonWebsocketConsumer):
    async def connect(self):
        self.chat_id = self.scope['url_route']['kwargs']['chat_id']
        self.chat_group_name = f'chat_{self.chat_id}'
        self.user = self.scope.get('user')

        chat = await get_chat(self.chat_id)
        is_member = await is_chat_member(self.chat_id, self.user.id) if self.user.is_authenticated else False
        if not chat or not self.user.is_authenticated or not is_member:
            await self.close()
            return

        await set_user_online(self.user, online=True)
        await self.channel_layer.group_add(self.chat_group_name, self.channel_name)
        await self.accept()

        await self.channel_layer.group_send(
            self.chat_group_name,
            {
                'type': 'chat.user_status',
                'user': self.user.username,
                'online': True,
            },
        )

    async def disconnect(self, code):
        await set_user_online(self.user, online=False)
        await self.channel_layer.group_discard(self.chat_group_name, self.channel_name)
        await self.channel_layer.group_send(
            self.chat_group_name,
            {
                'type': 'chat.user_status',
                'user': self.user.username,
                'online': False,
            },
        )

    async def receive_json(self, content):
        action = content.get('type')
        if action == 'message.send':
            await self.send_message(content)
        elif action == 'message.read':
            await self.read_message(content)
        elif action == 'message.react':
            await self.react_message(content)
        elif action == 'typing.start':
            await self.typing_event(start=True)
        elif action == 'typing.stop':
            await self.typing_event(start=False)

    async def send_message(self, content):
        text = content.get('text', '').strip()
        if not text:
            return

        message = await create_message(self.chat_id, self.user, text)
        await self.send_new_message(message)
        notify_new_message.delay(message.id)

    async def read_message(self, content):
        message_id = content.get('message_id')
        if not message_id:
            return
        status = await mark_message_read(message_id, self.user)
        await self.channel_layer.group_send(
            self.chat_group_name,
            {
                'type': 'chat.read',
                'message_id': message_id,
                'user': self.user.username,
                'read': status.read,
                'read_at': status.read_at.isoformat() if status.read_at else None,
            },
        )

    async def react_message(self, content):
        message_id = content.get('message_id')
        emoji = content.get('emoji')
        if not message_id or not emoji:
            return

        if content.get('action') == 'remove':
            await remove_reaction(message_id, self.user, emoji)
            reaction_data = None
        else:
            reaction, created = await add_reaction(message_id, self.user, emoji)
            reaction_data = {
                'id': reaction.id,
                'emoji': reaction.emoji,
                'user': self.user.username,
                'created_at': reaction.created_at.isoformat(),
            }

        await self.channel_layer.group_send(
            self.chat_group_name,
            {
                'type': 'chat.reaction',
                'message_id': message_id,
                'reaction': reaction_data,
                'user': self.user.username,
                'removed': content.get('action') == 'remove',
            },
        )

    async def typing_event(self, start=False):
        await self.channel_layer.group_send(
            self.chat_group_name,
            {
                'type': 'chat.typing',
                'user': self.user.username,
                'is_typing': start,
            },
        )

    async def send_new_message(self, message):
        payload = {
            'type': 'chat.message',
            'message': {
                'id': message.id,
                'chat': self.chat_id,
                'sender': {
                    'id': self.user.id,
                    'username': self.user.username,
                    'avatar': self.user.avatar.url if getattr(self.user, 'avatar', None) else None,
                },
                'content': message.content,
                'attachment': message.attachment.url if message.attachment else None,
                'created_at': message.created_at.isoformat(),
                'edited_at': message.edited_at.isoformat() if message.edited_at else None,
                'deleted_at': message.deleted_at.isoformat() if message.deleted_at else None,
                'reactions': [],
                'status': {
                    'delivered': True,
                    'read': True,
                    'delivered_at': message.created_at.isoformat(),
                    'read_at': message.created_at.isoformat(),
                },
            },
        }
        await self.channel_layer.group_send(self.chat_group_name, payload)

    async def chat_message(self, event):
        await self.send_json(event)

    async def chat_typing(self, event):
        await self.send_json(event)

    async def chat_read(self, event):
        await self.send_json(event)

    async def chat_reaction(self, event):
        await self.send_json(event)

    async def chat_user_status(self, event):
        await self.send_json(event)
