# encoding=utf8

from django.db import models
from django.contrib.auth.models import User
from django.urls import reverse
from django.db import models
from django.conf import settings

User = settings.AUTH_USER_MODEL


class Room(models.Model):
    name = models.CharField(max_length=250, unique=True)
    slug = models.SlugField()
    description = models.TextField()
    subscribers = models.ManyToManyField(User, blank=True)

    # раньше было NullBooleanField — в новых версиях его нет
    allow_anonymous_access = models.BooleanField(null=True, blank=True)
    private = models.BooleanField(null=True, blank=True)
    password = models.CharField(max_length=32, blank=True)

    def __str__(self):
        return self.name

    def get_absolute_url(self):
        return reverse("room_view", kwargs={"slug": self.slug})


class Message(models.Model):
    # обязательно on_delete для ForeignKey
    user = models.ForeignKey(
        User,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="chat_messages",
    )
    # имя гостя / отображаемое имя
    username = models.CharField(max_length=20, blank=True)
    date = models.DateTimeField()
    room = models.ForeignKey(
        Room,
        on_delete=models.CASCADE,
        related_name="messages",
    )
    content = models.CharField(max_length=5000)

    def __str__(self):
        return f"{self.username or self.user} @ {self.date}: {self.content[:30]}"


# ==========================
#   ЧАТ ПО ПАЦИЕНТУ
# ==========================


class PatientChatRoom(models.Model):
    # Один чат на одного пациента
    patient = models.OneToOneField(
        'hospital.Patient',
        on_delete=models.CASCADE,
        related_name='chat_room'
    )
    # Просто человеко-читаемое имя комнаты
    name = models.CharField(max_length=255, blank=True)
    # Участники чата (врачи, медсёстры и т.д.)
    participants = models.ManyToManyField(
        settings.AUTH_USER_MODEL,
        related_name='patient_chat_rooms',
        blank=True,
    )
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.name or f"Chat for patient {self.patient_id}"


class PatientChatMessage(models.Model):
    room = models.ForeignKey("chatrooms.PatientChatRoom", on_delete=models.CASCADE, related_name="messages", null=True, blank=True)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True)
    content = models.TextField(null=True, blank=True)
    timestamp = models.DateTimeField(auto_now_add=True, null=True, blank=True)

    class Meta:
        ordering = ['timestamp']

    def __str__(self):
        return f"{self.user} in room {self.room_id} at {self.timestamp}"