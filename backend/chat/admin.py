from django.contrib import admin

from .models import Chat, ChatParticipant, Message, MessageStatus, Reaction


@admin.register(Chat)
class ChatAdmin(admin.ModelAdmin):
    list_display = ['id', 'name', 'is_group', 'created_at']
    search_fields = ['name']


@admin.register(ChatParticipant)
class ChatParticipantAdmin(admin.ModelAdmin):
    list_display = ['chat', 'user', 'is_admin', 'joined_at']
    list_filter = ['is_admin']


@admin.register(Message)
class MessageAdmin(admin.ModelAdmin):
    list_display = ['id', 'chat', 'sender', 'created_at', 'deleted_at']
    search_fields = ['content']


@admin.register(MessageStatus)
class MessageStatusAdmin(admin.ModelAdmin):
    list_display = ['message', 'user', 'delivered', 'read']


@admin.register(Reaction)
class ReactionAdmin(admin.ModelAdmin):
    list_display = ['message', 'user', 'emoji', 'created_at']
