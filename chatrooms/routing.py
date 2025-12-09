from django.urls import re_path
from . import consumers

websocket_urlpatterns = [
    re_path(r"ws/patient-chat/(?P<room_id>\d+)/$", consumers.PatientChatConsumer.as_asgi()),
]