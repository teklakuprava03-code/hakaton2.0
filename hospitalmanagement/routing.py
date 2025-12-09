from django.urls import re_path
from chatrooms.consumers import PatientChatConsumer

websocket_urlpatterns = [
    re_path(r'ws/chat/patient/(?P<room_id>\d+)/$', PatientChatConsumer.as_asgi()),
]