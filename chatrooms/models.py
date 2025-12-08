#encoding=utf8

from django.db import models
from django.contrib.auth.models import User
from django.urls import reverse


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
