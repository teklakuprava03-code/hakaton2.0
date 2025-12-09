from django.http import JsonResponse
from django.contrib.auth.decorators import login_required
from chatrooms.models import PatientChatRoom, PatientChatMessage
from django.http import JsonResponse, HttpResponseNotAllowed
from django.contrib.auth.decorators import login_required
from django.shortcuts import get_object_or_404
from django.contrib.auth import get_user_model

from .models import PatientChatRoom, PatientChatMessage

User = get_user_model()

@login_required
def get_messages(request, room_id):
    try:
        room = PatientChatRoom.objects.get(id=room_id)
    except PatientChatRoom.DoesNotExist:
        return JsonResponse({"error": "Room not found"}, status=404)

    messages = room.messages.select_related("sender").order_by("timestamp")

    return JsonResponse(
        [
            {
                "sender": msg.sender.username,
                "content": msg.content,
                "timestamp": msg.timestamp.isoformat()
            }
            for msg in messages
        ],
        safe=False
    )

@login_required
def invite_to_patient_chat(request, room_id):
    """
    Пригласить пользователя (по username) в чат конкретного пациента.
    Доступ: только участник этой комнаты.
    """
    if request.method != "POST":
        return HttpResponseNotAllowed(["POST"])

    room = get_object_or_404(PatientChatRoom, id=room_id)

    # Проверяем, что текущий пользователь уже участвует в чате
    if request.user not in room.participants.all():
        return JsonResponse({"error": "forbidden"}, status=403)

    username = request.POST.get("username", "").strip()
    if not username:
        return JsonResponse({"error": "username is required"}, status=400)

    try:
        user_to_add = User.objects.get(username=username)
    except User.DoesNotExist:
        return JsonResponse({"error": "user not found"}, status=404)

    room.participants.add(user_to_add)

    return JsonResponse({"status": "ok", "added": user_to_add.username})