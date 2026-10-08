from django.contrib.auth import get_user_model
from rest_framework import serializers

from .models import Chat, ChatParticipant, Message, Reaction, Notification

User = get_user_model()


class UserBriefSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'username', 'avatar', 'status', 'online']


class ReactionSerializer(serializers.ModelSerializer):
    user = UserBriefSerializer(read_only=True)

    class Meta:
        model = Reaction
        fields = ['id', 'emoji', 'user', 'created_at']
        read_only_fields = ['id', 'user', 'created_at']


class MessageSerializer(serializers.ModelSerializer):
    sender = UserBriefSerializer(read_only=True)
    reactions = ReactionSerializer(many=True, read_only=True)
    status = serializers.SerializerMethodField()

    class Meta:
        model = Message
        fields = [
            'id',
            'chat',
            'sender',
            'content',
            'attachment',
            'created_at',
            'edited_at',
            'deleted_at',
            'reactions',
            'status',
        ]
        read_only_fields = ['id', 'sender', 'created_at', 'edited_at', 'deleted_at', 'reactions', 'status']

    def get_status(self, obj):
        user = self.context.get('request').user if self.context else None
        if not user or not user.is_authenticated:
            return None
        status = obj.statuses.filter(user=user).first()
        if not status:
            return None
        return {
            'delivered': status.delivered,
            'read': status.read,
            'delivered_at': status.delivered_at,
            'read_at': status.read_at,
        }


class MessageCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Message
        fields = ['id', 'content', 'attachment']
        read_only_fields = ['id']


class ChatParticipantSerializer(serializers.ModelSerializer):
    user = UserBriefSerializer(read_only=True)

    class Meta:
        model = ChatParticipant
        fields = ['user', 'joined_at', 'is_admin']


class NotificationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Notification
        fields = ['id', 'title', 'body', 'created_at', 'read']
        read_only_fields = ['id', 'created_at']


class ChatSerializer(serializers.ModelSerializer):
    participants = UserBriefSerializer(many=True, read_only=True)
    last_message = serializers.SerializerMethodField()

    class Meta:
        model = Chat
        fields = ['id', 'name', 'is_group', 'participants', 'created_at', 'updated_at', 'last_message']

    def get_last_message(self, obj):
        last = obj.messages.order_by('-created_at').first()
        return MessageSerializer(last, context=self.context).data if last else None


class ChatCreateSerializer(serializers.ModelSerializer):
    participant_ids = serializers.ListField(child=serializers.IntegerField(), write_only=True, required=False)
    participants = UserBriefSerializer(many=True, read_only=True)

    class Meta:
        model = Chat
        fields = ['id', 'name', 'is_group', 'participant_ids', 'participants']
        read_only_fields = ['id', 'participants']

    def create(self, validated_data):
        participants = validated_data.pop('participant_ids', [])
        chat = Chat.objects.create(**validated_data)
        user = self.context['request'].user
        chat.participants.add(user)
        for user_id in set(participants):
            if user_id != user.id:
                chat.participants.add(user_id)
        return chat
