#encoding=utf8

from django.db import models
from django.contrib.auth.models import User
from django.urls import reverse
from hospital.models import Patient

class Room(models.Model):
    name = models.CharField(max_length=64, unique=True)
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
        return reverse('room_view', kwargs={'slug': self.slug})


class Message(models.Model):
    # обязательно on_delete для ForeignKey
    user = models.ForeignKey(
        User,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='chat_messages',
    )
    # имя гостя / отображаемое имя
    username = models.CharField(max_length=20, blank=True)
    date = models.DateTimeField()
    room = models.ForeignKey(
        Room,
        on_delete=models.CASCADE,
        related_name='messages',
    )
    content = models.CharField(max_length=5000)

    def __str__(self):
        return f'{self.username or self.user} @ {self.date}: {self.content[:30]}'

class PatientChatRoom(models.Model):
    """
    Одна комната чата на одного пациента.
    В participants лежат все пользователи (врачи, медсёстры, сам пациент),
    которые имеют доступ к этому чату.
    """
    patient = models.OneToOneField(
        Patient,
        on_delete=models.CASCADE,
        related_name='chat_room'
    )
    participants = models.ManyToManyField(
        User,
        related_name='patient_chat_rooms',
        blank=True
    )
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"ChatRoom for patient #{self.patient_id} - {self.patient.get_name if hasattr(self.patient, 'get_name') else ''}"


class PatientMessage(models.Model):
    room = models.ForeignKey(
        PatientChatRoom,
        on_delete=models.CASCADE,
        related_name='messages'
    )
    sender = models.ForeignKey(User, on_delete=models.CASCADE)
    text = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['created_at']

    def __str__(self):
        return f"[{self.created_at}] {self.sender}: {self.text[:20]}"



User = settings.AUTH_USER_MODEL


class PatientChatRoom(models.Model):
    """
    Один чат для одного пациента.
    У чата есть участники (доктора, медсёстры, сам пациент и т.п.).
    """
    patient = models.OneToOneField(
        Patient,
        related_name='chat_room',
        on_delete=models.CASCADE
    )
    participants = models.ManyToManyField(
        User,
        related_name='patient_chat_rooms',
        blank=True,
    )
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f'ChatRoom for {self.patient.get_name if hasattr(self.patient, "get_name") else self.patient.id}'


class PatientChatMessage(models.Model):
    room = models.ForeignKey(
        PatientChatRoom,
        related_name='messages',
        on_delete=models.CASCADE
    )
    sender = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='patient_chat_messages'
    )
    content = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['created_at']

    def __str__(self):
        return f'{self.sender} -> {self.room_id}: {self.content[:20]}'