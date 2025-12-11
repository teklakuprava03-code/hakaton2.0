# hospital/api_auth.py
from django.contrib.auth import authenticate, login, logout
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
import json

@csrf_exempt  # для начала можно так, потом лучше нормально с CSRF
def api_login(request):
    if request.method != "POST":
        return JsonResponse({"detail": "Метод не разрешён"}, status=405)

    try:
        data = json.loads(request.body.decode("utf-8"))
    except Exception:
        return JsonResponse({"detail": "Неверный JSON"}, status=400)

    username = data.get("username")
    password = data.get("password")

    user = authenticate(request, username=username, password=password)
    if user is None:
        return JsonResponse({"detail": "Неверные логин или пароль"}, status=400)

    login(request, user)
    return JsonResponse(
        {
            "id": user.id,
            "username": user.username,
            "first_name": user.first_name,
            "last_name": user.last_name,
        }
    )