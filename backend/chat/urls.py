from django.urls import path

from .views import (
    ChatCreateView,
    ChatDetailView,
    MessageCreateListView,
    MessageDetailView,
    ChatSearchView,
    MessageSearchView,
    NotificationListView,
    NotificationMarkReadView,
)

urlpatterns = [
    path('chats/', ChatCreateView.as_view(), name='chat_list_create'),
    path('chats/search/', ChatSearchView.as_view(), name='chat_search'),
    path('chats/<int:pk>/', ChatDetailView.as_view(), name='chat_detail'),
    path('chats/<int:chat_id>/messages/', MessageCreateListView.as_view(), name='message_list_create'),
    path('messages/search/', MessageSearchView.as_view(), name='message_search'),
    path('messages/<int:pk>/', MessageDetailView.as_view(), name='message_detail'),
    path('notifications/', NotificationListView.as_view(), name='notification_list'),
    path('notifications/<int:pk>/read/', NotificationMarkReadView.as_view(), name='notification_mark_read'),
]
