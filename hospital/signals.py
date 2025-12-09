from django.db.models.signals import post_save
from django.dispatch import receiver
from django.contrib.auth.models import User

from .models import Patient
from chatrooms.models import PatientChatRoom


@receiver(post_save, sender=Patient)
def create_patient_chat_room(sender, instance, created, **kwargs):
    """
    При создании пациента создаём ему чат-комнату
    и добавляем туда назначенного доктора (если есть),
    и самого пользователя-пациента (если связь понятна).
    """
    if not created:
        return

    room = PatientChatRoom.objects.create(patient=instance)

    # пациент
    if instance.user_id:
        try:
            user = User.objects.get(id=instance.user_id)
            room.participants.add(user)
        except User.DoesNotExist:
            pass

    # врач
    if instance.assignedDoctorId:
        try:
            doctor_user = User.objects.get(id=instance.assignedDoctorId)
            room.participants.add(doctor_user)
        except User.DoesNotExist:
            pass