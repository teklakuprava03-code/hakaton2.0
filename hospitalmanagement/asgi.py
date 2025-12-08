"""
ASGI config for hospitalmanagement project.

It exposes the ASGI callable as a module-level variable named ``application``.

For more information on this file, see
https://docs.djangoproject.com/en/3.0/howto/deployment/asgi/
"""


import os

from django.core.asgi import get_asgi_application

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'hospitalmanagement.settings')

application = get_asgi_application()


"""
import os
import django
from channels.routing import ProtocolTypeRouter, URLRouter
from channels.auth import AuthMiddlewareStack
from django.core.asgi import get_asgi_application

# Указываем настройки проекта
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'hospitalmanagement.settings')

# Инициализация Django
django.setup()

# Импорт websocket-маршрутов из приложения чатов
# !!! ВАЖНО: путь должен совпадать с тем, как называется твое приложение чатов !!!
import chatrooms.routing

# HTTP и WebSocket приложение
application = ProtocolTypeRouter({
    "http": get_asgi_application(),

    "websocket": AuthMiddlewareStack(
        URLRouter(
            chatrooms.routing.websocket_urlpatterns
        )
    ),
})
"""