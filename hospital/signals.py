# hospital/signals.py
from django.db.models.signals import post_save
from django.dispatch import receiver
from django.apps import apps

from .models import Patient


@receiver(post_save, sender=Patient)
def create_chat_room_for_patient(sender, instance, created, **kwargs):
    if not created:
        return

    # Берём модель через apps.get_model, чтобы НЕ было циклического импорта
    PatientChatRoom = apps.get_model('chatrooms', 'PatientChatRoom')

    # Если нужно поле name — оно должно быть в модели.
    # Если в модели нет name — убери этот аргумент.
    PatientChatRoom.objects.create(
        patient=instance,
        # раскомментируй, только если в модели есть поле name:
        # name=f"Chat for patient {instance.id}"
    )

from django.db.models.signals import post_save
from django.dispatch import receiver
from .models import Patient
from django.apps import apps

@receiver(post_save, sender=Patient)
def create_chat_room_for_patient(sender, instance, created, **kwargs):
    if created:
        PatientChatRoom = apps.get_model('chatrooms', 'PatientChatRoom')
        PatientChatRoom.objects.create(
            patient=instance,
            name=f"Chat for patient {instance.id}"
        )