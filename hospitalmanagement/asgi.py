import os
from django.core.asgi import get_asgi_application
from channels.routing import ProtocolTypeRouter, URLRouter
from channels.auth import AuthMiddlewareStack
import chatrooms.routing  # это файл, который мы создадим

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'hospitalmanagement.settings')

django_asgi_app = get_asgi_application()



import chatrooms.routing
application = ProtocolTypeRouter({
    "http": get_asgi_application(),
    "websocket": AuthMiddlewareStack(
        URLRouter(chatrooms.routing.websocket_urlpatterns)
    ),
})