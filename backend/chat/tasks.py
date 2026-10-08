from celery import shared_task

from .models import Message, Notification


@shared_task
def notify_new_message(message_id: int):
    try:
        message = Message.objects.select_related('chat', 'sender').get(pk=message_id)
    except Message.DoesNotExist:
        return

    chat_name = message.chat.name or f'Chat {message.chat.pk}'
    notification_body = message.content or 'You have a new message.'

    recipients = message.chat.participants.exclude(pk=message.sender.pk)
    notifications = []
    for user in recipients:
        notifications.append(
            Notification(
                user=user,
                title=f'New message in {chat_name}',
                body=notification_body,
            )
        )

    Notification.objects.bulk_create(notifications)
