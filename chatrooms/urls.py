#encoding=utf8
"""
try:
    from django.conf.urls.defaults import url, patterns
#Django 1.6+
except:
    from django.conf.urls import url, patterns


from . import views
from .utils.decorators import room_check_access
from .ajax import chat

urlpatterns = patterns('chatrooms',
    # room views
    url(r'^rooms/$',
        views.RoomsListView.as_view(),
        name="rooms_list"),
    url(r'^room/(?P<slug>[-\w\d]+)/$',
        room_check_access(views.RoomView.as_view()),
        name="room_view"),
    url(r'^setguestname/$',
        views.GuestNameView.as_view(),
        name="set_guestname"),

    # ajax requests
    url(r'^get_messages/', chat.ChatView().get_messages),
    url(r'^send_message/', chat.ChatView().send_message),
    url(r'^get_latest_msg_id/', chat.ChatView().get_latest_message_id),
    url(r'^get_users_list/$', chat.ChatView().get_users_list),
    url(r'^notify_users_list/$', chat.ChatView().notify_users_list),
)
"""
"""
#encoding=utf8

from django.conf.urls import url
from . import views
from .utils.decorators import room_check_access
from .ajax import chat

app_name = 'chatrooms'

urlpatterns = [
    # room views
    url(r'^rooms/$',
        views.RoomsListView.as_view(),
        name="rooms_list"),
    url(r'^room/(?P<slug>[-\w\d]+)/$',
        room_check_access(views.RoomView.as_view()),
        name="room_view"),
    url(r'^setguestname/$',
        views.GuestNameView.as_view(),
        name="set_guestname"),

    # ajax requests
    url(r'^get_messages/', chat.ChatView().get_messages),
    url(r'^send_message/', chat.ChatView().send_message),
    url(r'^get_latest_msg_id/', chat.ChatView().get_latest_message_id),
    url(r'^get_users_list/$', chat.ChatView().get_users_list),
    url(r'^notify_users_list/$', chat.ChatView().notify_users_list),
]
"""
"""
#encoding=utf8

from django.urls import path, re_path

from . import views
from .utils.decorators import room_check_access
from .ajax import chat

# --- Safe wrappers so ChatView is not instantiated at import time ---

def get_messages_view(request, *args, **kwargs):
    return chat.ChatView().get_messages(request, *args, **kwargs)

def send_message_view(request, *args, **kwargs):
    return chat.ChatView().send_message(request, *args, **kwargs)

def get_latest_msg_id_view(request, *args, **kwargs):
    return chat.ChatView().get_latest_message_id(request, *args, **kwargs)

def get_users_list_view(request, *args, **kwargs):
    return chat.ChatView().get_users_list(request, *args, **kwargs)

def notify_users_list_view(request, *args, **kwargs):
    return chat.ChatView().notify_users_list(request, *args, **kwargs)

urlpatterns = [
    # room views
    path(
        'rooms/',
        views.RoomsListView.as_view(),
        name="rooms_list"
    ),
    re_path(
        r'^room/(?P<slug>[-\w\d]+)/$',
        room_check_access(views.RoomView.as_view()),
        name="room_view"
    ),
    path(
        'setguestname/',
        views.GuestNameView.as_view(),
        name="set_guestname"
    ),

    # ajax requests
    path('get_messages/', get_messages_view, name='get_messages'),
    path('send_message/', send_message_view, name='send_message'),
    path('get_latest_msg_id/', get_latest_msg_id_view, name='get_latest_message_id'),
    path('get_users_list/', get_users_list_view, name='get_users_list'),
    path('notify_users_list/', notify_users_list_view, name='notify_users_list'),

]
"""



#--------
#encoding=utf8
"""
URL-ы для приложения chatrooms.
После этих настроек:
- /chat/rooms/         — список комнат
- /chat/room/<slug>/   — конкретная комната
- остальные пути — AJAX-эндпоинты для чата
"""

from django.urls import path

from . import views
from .utils.decorators import room_check_access
from .ajax import chat
from .views_patient_chat import get_messages
from .views_patient_chat import get_messages, invite_to_patient_chat

# === Обёртки вокруг ChatView, чтобы он не создавался при импорте ===

def get_messages_view(request, *args, **kwargs):
    return chat.ChatView().get_messages(request, *args, **kwargs)


def send_message_view(request, *args, **kwargs):
    return chat.ChatView().send_message(request, *args, **kwargs)


def get_latest_msg_id_view(request, *args, **kwargs):
    return chat.ChatView().get_latest_message_id(request, *args, **kwargs)


def get_users_list_view(request, *args, **kwargs):
    return chat.ChatView().get_users_list(request, *args, **kwargs)


def notify_users_list_view(request, *args, **kwargs):
    return chat.ChatView().notify_users_list(request, *args, **kwargs)


# === Основные URL-ы чата ===

urlpatterns = [
    # Страница со списком комнат: /chat/rooms/
    path(
        "rooms/",
        views.RoomsListView.as_view(),
        name="rooms_list",
    ),

    # Страница одной комнаты: /chat/room/<slug>/
    path(
        "room/<slug:slug>/",
        room_check_access(views.RoomView.as_view()),
        name="room_view",
    ),

    # Установка гостевого имени
    path(
        "setguestname/",
        views.GuestNameView.as_view(),
        name="set_guestname",
    ),

    path('api/my-rooms/', views.my_patient_rooms, name='my-patient-rooms'),
    path('api/rooms/<int:room_id>/messages/', views.patient_chat_messages, name='patient-chat-messages'),
    path('api/rooms/<int:room_id>/invite/', views.invite_to_patient_chat, name='invite-to-patient-chat'),
    path('patient/<int:room_id>/messages/', get_messages, name='patient_chat_messages'),
    path(
        'patient/<int:room_id>/invite/',
        invite_to_patient_chat,
        name='patient_chat_invite'
    ),

    # AJAX-запросы
    path("get_messages/", get_messages_view, name="get_messages"),
    path("send_message/", send_message_view, name="send_message"),
    path("get_latest_msg_id/", get_latest_msg_id_view, name="get_latest_message_id"),
    path("get_users_list/", get_users_list_view, name="get_users_list"),
    path("notify_users_list/", notify_users_list_view, name="notify_users_list"),
]