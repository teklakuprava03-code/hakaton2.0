from channels.db import database_sync_to_async
from django.contrib.auth import get_user_model
import json
from channels.generic.websocket import AsyncWebsocketConsumer

from .models import PatientChatRoom, PatientChatMessage

User = get_user_model()


class PatientChatConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        user = self.scope["user"]
        if not user.is_authenticated:
            await self.close()
            return

        self.room_id = self.scope["url_route"]["kwargs"]["room_id"]
        self.room_group_name = f"patient_chat_{self.room_id}"

        # проверяем, есть ли доступ к комнате
        has_access = await self.user_has_access(user, self.room_id)
        if not has_access:
            await self.close()
            return

        await self.channel_layer.group_add(
            self.room_group_name,
            self.channel_name,
        )
        await self.accept()

    async def disconnect(self, close_code):
        await self.channel_layer.group_discard(
            self.room_group_name,
            self.channel_name,
        )

    async def receive(self, text_data=None, bytes_data=None):
        user = self.scope["user"]
        if not user.is_authenticated:
            return

        try:
            data = json.loads(text_data)
        except Exception:
            return

        message = data.get("message", "").strip()
        if not message:
            return

        msg_obj = await self.save_message(user, self.room_id, message)

        await self.channel_layer.group_send(
            self.room_group_name,
            {
                "type": "chat.message",
                "id": msg_obj.id,
                "sender": user.get_full_name() or user.username,
                "content": msg_obj.content,
                "created_at": msg_obj.created_at.isoformat(),
                "sender_id": user.id,
            },
        )

    async def chat_message(self, event):
        await self.send(text_data=json.dumps({
            "id": event["id"],
            "sender": event["sender"],
            "content": event["content"],
            "created_at": event["created_at"],
            "sender_id": event["sender_id"],
        }))

    # ----------------- helpers -----------------

    @database_sync_to_async
    def user_has_access(self, user, room_id):
        try:
            room = PatientChatRoom.objects.get(id=room_id)
        except PatientChatRoom.DoesNotExist:
            return False
        return room.participants.filter(id=user.id).exists()

    @database_sync_to_async
    def save_message(self, user, room_id, content):
        room = PatientChatRoom.objects.get(id=room_id)
        return PatientChatMessage.objects.create(
            room=room,
            sender=user,
            content=content,
        )



class PatientChatConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.room_id = self.scope['url_route']['kwargs']['room_id']
        self.room_group = f"patient_chat_{self.room_id}"

        await self.channel_layer.group_add(self.room_group, self.channel_name)
        await self.accept()

    async def disconnect(self, close_code):
        await self.channel_layer.group_discard(self.room_group, self.channel_name)

    async def receive(self, text_data):
        data = json.loads(text_data)
        msg = data["message"]
        user = self.scope["user"]

        # save message
        room = await database_sync_to_async(PatientChatRoom.objects.get)(id=self.room_id)
        await database_sync_to_async(PatientChatMessage.objects.create)(
            room=room,
            sender=user,
            content=msg
        )

        await self.channel_layer.group_send(
            self.room_group,
            {
                "type": "chat_message",
                "message": msg,
                "sender": user.username
            }
        )

    async def chat_message(self, event):
        await self.send(text_data=json.dumps(event))