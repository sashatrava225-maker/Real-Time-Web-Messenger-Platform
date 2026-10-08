from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import generics, permissions
from rest_framework.exceptions import PermissionDenied
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser

from .models import Chat, Message, MessageStatus, Notification
from .serializers import (
    ChatCreateSerializer,
    ChatSerializer,
    MessageCreateSerializer,
    MessageSerializer,
    NotificationSerializer,
)
from .tasks import notify_new_message


class ChatCreateView(generics.ListCreateAPIView):
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return Chat.objects.filter(participants=self.request.user).prefetch_related('participants', 'messages')

    def get_serializer_class(self):
        if self.request.method == 'POST':
            return ChatCreateSerializer
        return ChatSerializer

    def perform_create(self, serializer):
        serializer.save()


class ChatDetailView(generics.RetrieveUpdateAPIView):
    permission_classes = [permissions.IsAuthenticated]
    queryset = Chat.objects.all()
    serializer_class = ChatSerializer

    def get_object(self):
        chat = get_object_or_404(Chat, pk=self.kwargs['pk'])
        if self.request.user not in chat.participants.all():
            raise PermissionDenied('You are not a member of this chat.')
        return chat


class ChatSearchView(generics.ListAPIView):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = ChatSerializer

    def get_queryset(self):
        query = self.request.query_params.get('q', '')
        return Chat.objects.filter(name__icontains=query, participants=self.request.user)


class MessageCreateListView(generics.ListCreateAPIView):
    permission_classes = [permissions.IsAuthenticated]
    parser_classes = [JSONParser, MultiPartParser, FormParser]

    def get_chat(self):
        return get_object_or_404(Chat, pk=self.kwargs['chat_id'])

    def get_queryset(self):
        chat = self.get_chat()
        if self.request.user not in chat.participants.all():
            raise PermissionDenied('You are not a member of this chat.')

        self._mark_messages_delivered(chat)
        return Message.objects.filter(chat=chat).order_by('created_at')

    def get_serializer_class(self):
        if self.request.method == 'POST':
            return MessageCreateSerializer
        return MessageSerializer

    def _mark_messages_delivered(self, chat):
        messages = Message.objects.filter(chat=chat).exclude(sender=self.request.user)
        for message in messages:
            MessageStatus.objects.get_or_create(
                message=message,
                user=self.request.user,
                defaults={'delivered': True, 'delivered_at': timezone.now()},
            )

    def perform_create(self, serializer):
        chat = self.get_chat()
        if self.request.user not in chat.participants.all():
            raise PermissionDenied('You are not a member of this chat.')
        message = serializer.save(chat=chat, sender=self.request.user)
        notify_new_message.delay(message.id)


class MessageSearchView(generics.ListAPIView):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = MessageSerializer

    def get_queryset(self):
        query = self.request.query_params.get('q', '')
        return Message.objects.filter(
            chat__participants=self.request.user,
            content__icontains=query,
        ).order_by('-created_at')[:100]


class NotificationListView(generics.ListAPIView):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = NotificationSerializer

    def get_queryset(self):
        return Notification.objects.filter(user=self.request.user).order_by('-created_at')


class NotificationMarkReadView(generics.UpdateAPIView):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = NotificationSerializer
    queryset = Notification.objects.all()

    def get_object(self):
        notification = super().get_object()
        if notification.user != self.request.user:
            raise PermissionDenied('You can only update your own notifications.')
        return notification

    def perform_update(self, serializer):
        serializer.save(read=True)


class MessageDetailView(generics.RetrieveUpdateDestroyAPIView):
    permission_classes = [permissions.IsAuthenticated]
    queryset = Message.objects.all()
    serializer_class = MessageSerializer

    def get_object(self):
        message = super().get_object()
        if self.request.user != message.sender:
            raise PermissionDenied('You can only manage your own messages.')
        return message

    def perform_update(self, serializer):
        serializer.save(edited_at=timezone.now())

    def perform_destroy(self, instance):
        instance.deleted_at = timezone.now()
        instance.save()
