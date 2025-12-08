# encoding: utf-8

import json
import itertools
from datetime import datetime, timedelta
from collections import deque

from django.conf import settings
from django.db.models.signals import post_save
from django.dispatch import receiver
from django.utils.decorators import method_decorator

from gevent.event import Event

from ..models import Room, Message
from ..utils.auth import check_user_passes_test
from ..utils.decorators import ajax_user_passes_test_or_403, ajax_room_login_required
from ..utils.compat import HttpResponse, HttpResponseBadRequest


TIME_FORMAT = "%Y-%m-%dT%H:%M:%S:%f"

TIMEOUT = 30
if settings.DEBUG:
    TIMEOUT = 3


class MessageWrapper:
    """
    Простая структура для хранения сообщения.
    """
    def __init__(self, username, content, date):
        self.username = username
        self.content = content
        self.date = date


class ChatView(object):
    """
    Singleton-класс, который обслуживает все AJAX-запросы чата.
    """

    _instance = None

    def __new__(cls, *args, **kwargs):
        if not cls._instance:
            self = super(ChatView, cls).__new__(cls, *args, **kwargs)
            ChatView.__init__(self, *args, **kwargs)
            cls._instance = self
        return cls._instance

    def __init__(self):
        """
        Для каждой комнаты храним:
        - new_message_events: Event для long polling сообщений
        - messages: очередь из последних 50 сообщений ([(id, MessageWrapper), ...])
        - counters: итератор для id сообщений
        - connected_users: словарь user -> время последнего запроса
        - new_connected_user_event: Event для long polling списка юзеров
        """
        self.new_message_events = {}
        self.messages = {}
        self.counters = {}
        self.connected_users = {}
        self.new_connected_user_event = {}

        # Инициализируем структуры для уже существующих комнат
        rooms = Room.objects.all()
        for room in rooms:
            self._init_room(room.id)

    # ---------- служебные методы ----------

    def _init_room(self, room_id):
        """
        Создаёт структуры данных для комнаты, если их ещё нет.
        """
        if room_id not in self.new_message_events:
            self.new_message_events[room_id] = Event()
        if room_id not in self.messages:
            self.messages[room_id] = deque(maxlen=50)
        if room_id not in self.counters:
            self.counters[room_id] = itertools.count(1)
        if room_id not in self.connected_users:
            self.connected_users[room_id] = {}
        if room_id not in self.new_connected_user_event:
            self.new_connected_user_event[room_id] = Event()

    def get_username(self, request):
        """Возвращает username авторизованного пользователя или guest-имя."""
        if request.user.is_authenticated:
            username = request.user.username
        else:
            guestname = request.session.get("guest_name")
            username = "(guest) %s" % guestname
        return username

    def signal_new_message_event(self, room_id):
        """Сигнализирует о новом сообщении в комнате."""
        self.new_message_events[room_id].set()
        self.new_message_events[room_id].clear()

    def wait_for_new_message(self, room_id, timeout=TIMEOUT):
        """Блокирующее ожидание нового сообщения."""
        self.new_message_events[room_id].wait(timeout)

    def get_messages_queue(self, room_id):
        """Возвращает очередь сообщений комнаты."""
        self._init_room(room_id)
        return self.messages[room_id]

    def get_next_message_id(self, room_id):
        """Возвращает следующий id сообщения."""
        self._init_room(room_id)
        return next(self.counters[room_id])

    def get_connected_users(self, room_id):
        """Возвращает словарь подключённых пользователей."""
        self._init_room(room_id)
        return self.connected_users[room_id]

    # ---------- AJAX-views ----------

    @method_decorator(ajax_room_login_required)
    @method_decorator(ajax_user_passes_test_or_403(check_user_passes_test))
    def get_messages(self, request):
        """Возвращает список новых сообщений из БД.

        Ожидает GET-параметры:
        - room_id
        - latest_message_id
        """
        try:
            room_id = int(request.GET['room_id'])
            latest_msg_id = int(request.GET['latest_message_id'])
        except (KeyError, ValueError):
            return HttpResponseBadRequest(
                "Parameters missing or bad parameters. "
                "Expected a GET request with 'room_id' and 'latest_message_id' "
                "parameters"
            )

        messages_qs = (
            Message.objects
            .filter(room_id=room_id, id__gt=latest_msg_id)
            .order_by('id')
        )

        to_jsonify = [
            {
                "message_id": msg.id,
                "username": msg.username,
                "date": msg.date.strftime(TIME_FORMAT),
                "content": msg.content,
            }
            for msg in messages_qs
        ]

        return HttpResponse(
            json.dumps(to_jsonify),
            content_type="application/json",
        )

    @method_decorator(ajax_room_login_required)
    @method_decorator(ajax_user_passes_test_or_403(check_user_passes_test))
    def send_message(self, request):
        """Сохраняет сообщение в БД и возвращает timestamp и id сообщения."""
        try:
            room_id = int(request.POST['room_id'])
            content = request.POST['message']
            date = datetime.now()
        except (KeyError, ValueError):
            return HttpResponseBadRequest(
                "Parameters missing or bad parameters. "
                "Expected a POST request with 'room_id' and 'message' parameters"
            )

        username = self.get_username(request)

        try:
            room = Room.objects.get(pk=room_id)
        except Room.DoesNotExist:
            return HttpResponseBadRequest("Unknown room")

        # Сохраняем сообщение в БД
        msg = Message.objects.create(
            room=room,
            username=username,
            content=content,
            date=date,
        )

        # Старый сигнал оставлять не обязательно, он теперь не нужен.
        # chat_message_received.send(...)

        return HttpResponse(
            json.dumps({
                "timestamp": date.strftime(TIME_FORMAT),
                "message_id": msg.id,
            }),
            content_type="application/json",
        )

    @method_decorator(ajax_room_login_required)
    @method_decorator(ajax_user_passes_test_or_403(check_user_passes_test))
    def notify_users_list(self, request):
        """Обновляет время активности пользователя в комнате."""
        try:
            room_id = int(request.POST["room_id"])
        except Exception:
            return HttpResponseBadRequest(
                "Parameters missing or bad parameters. "
                "Expected a POST request with 'room_id'"
            )

        self._init_room(room_id)

        username = self.get_username(request)
        date = datetime.today()

        self.connected_users[room_id].update({username: date})
        self.new_connected_user_event[room_id].set()
        self.new_connected_user_event[room_id].clear()

        return HttpResponse("Connected")

    @method_decorator(ajax_room_login_required)
    @method_decorator(ajax_user_passes_test_or_403(check_user_passes_test))
    def get_users_list(self, request):
        """Возвращает список подключённых пользователей (long polling)."""
        REFRESH_TIME = 8

        try:
            room_id = int(request.GET.get("room_id"))
        except (TypeError, ValueError):
            return HttpResponseBadRequest(
                "Parameters missing or bad parameters. "
                "Expected a GET request with 'room_id'"
            )

        self._init_room(room_id)

        username = self.get_username(request)
        self.connected_users[room_id].update({username: datetime.today()})

        self.new_connected_user_event[room_id].wait(REFRESH_TIME)

        self._clean_connected_users(room_id)

        json_users = [
            {"username": _user, "date": _date.strftime(TIME_FORMAT)}
            for _user, _date in self.connected_users[room_id].items()
        ]

        json_response = {
            "now": datetime.today().strftime(TIME_FORMAT),
            "users": json_users,
            "refresh": str(REFRESH_TIME),
        }

        return HttpResponse(
            json.dumps(json_response),
            content_type="application/json",
        )

    @method_decorator(ajax_room_login_required)
    @method_decorator(ajax_user_passes_test_or_403(check_user_passes_test))
    def get_latest_message_id(self, request):
        """Возвращает id последнего сообщения в комнате."""
        try:
            room_id = int(request.GET['room_id'])
        except (KeyError, ValueError):
            return HttpResponseBadRequest("room_id missing or invalid")

        try:
            latest_msg = (
                Message.objects
                .filter(room_id=room_id)
                .latest("id")
            )
            latest_id = latest_msg.id
        except Message.DoesNotExist:
            latest_id = 0

        response = {"id": latest_id}
        return HttpResponse(
            json.dumps(response),
            content_type="application/json",
        )
    # --------- служебные методы ---------

    def _clean_connected_users(self, room_id, seconds=60):
        """
        Удаляет из словаря пользователей, которых не было
        дольше `seconds`.
        """
        self._init_room(room_id)
        now = datetime.today()
        for usr, date in list(self.connected_users[room_id].items()):
            if (now - timedelta(seconds=seconds)) > date:
                self.connected_users[room_id].pop(usr, None)


@receiver(post_save, sender=Room)
def create_events_for_new_room(sender, **kwargs):
    """
    Создаёт структуры данных в ChatView для новой комнаты
    при её создании.
    """
    if kwargs.get("created"):
        instance = kwargs.get("instance")
        room_id = instance.id

        chatview = ChatView()
        chatview._init_room(room_id)