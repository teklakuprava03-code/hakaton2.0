# encoding=utf8
from functools import wraps

from django.conf import settings
from django.contrib.auth.decorators import login_required
from django.http import (
    HttpResponse,
    HttpResponseForbidden,
    HttpResponseRedirect,
)
from django.shortcuts import render, get_object_or_404
from django.urls import reverse

from ..models import Room


def _is_ajax(request) -> bool:
    """
    Заменяем старый request.is_ajax() на проверку заголовка.
    """
    return request.headers.get("x-requested-with") == "XMLHttpRequest"


def ajax_user_passes_test_or_403(test_func, message="Access denied"):
    """
    Декоратор для вьюх: если пользователь не проходит test_func,
    то:
      * для AJAX-запроса — 403 с текстом message
      * для обычного запроса — рендерим 403.html
    test_func(request, user) -> bool
    """

    def decorator(view_func):
        @wraps(view_func)
        def _wrapped_view(request, *args, **kwargs):
            if test_func(request, request.user):
                return view_func(request, *args, **kwargs)

            # AJAX → просто 403
            if _is_ajax(request):
                return HttpResponseForbidden(message)

            # Обычный запрос → страница 403
            return render(request, "403.html", status=403)

        return _wrapped_view

    return decorator


def ajax_room_login_required(view_func):
    """
    Обработка неавторизованных пользователей для AJAX-запросов.
    Если у комнаты allow_anonymous_access=True, анонимов пускаем.
    """

    @wraps(view_func)
    def _wrapped_view(request, *args, **kwargs):
        # в старом коде было request.REQUEST — теперь GET+POST
        room_id = request.POST.get("room_id") or request.GET.get("room_id")

        if room_id:
            room = get_object_or_404(Room, pk=room_id)
            if room.allow_anonymous_access:
                return view_func(request, *args, **kwargs)

        if _is_ajax(request):
            if request.user.is_authenticated:
                return view_func(request, *args, **kwargs)
            else:
                response = HttpResponse()
                response["X-Django-Requires-Auth"] = "true"
                response["X-Django-Login-Url"] = settings.LOGIN_URL
                return response

        # не AJAX → обычный login_required
        return login_required(view_func)(request, *args, **kwargs)

    return _wrapped_view


def room_check_access(view_func):
    """
    Для детального RoomView.

    * Если комната не допускает анонимов — требуем логин.
    * Если допускает, но гость ещё не ввёл guest_name —
      редиректим на форму установки guest_name.
    """

    @wraps(view_func)
    def _wrapped_view(request, *args, **kwargs):
        room_slug = kwargs.get("slug")
        room = get_object_or_404(Room, slug=room_slug)

        if request.user.is_authenticated:
            return view_func(request, *args, **kwargs)

        if room.allow_anonymous_access:
            if not request.session.get("guest_name"):
                # TODO: можно использовать QueryDict, пока просто добавляем параметр
                url = reverse("set_guestname") + f"?room_slug={room_slug}"
                return HttpResponseRedirect(url)
            return view_func(request, *args, **kwargs)

        # если аноним и комната не пускает анонимов → login_required
        return login_required(view_func)(request, *args, **kwargs)

    return _wrapped_view


def signals_new_message_at_end(func):
    """
    Декоратор для MessageHandler.handle_received_message:
    после обработки сообщения шлёт сигнал о новом сообщении.
    """

    @wraps(func)
    def _wrapper(self, sender, room_id, username, message, date, **kwargs):
        result = func(self, sender, room_id, username, message, date, **kwargs)
        sender.signal_new_message_event(room_id)
        return result

    return _wrapper


def waits_for_new_message_at_start(func):
    """
    Декоратор для MessageHandler.retrieve_messages:
    перед получением сообщений ждём новое сообщение в комнате.
    """

    @wraps(func)
    def _wrapper(self, chatobj, room_id, *args, **kwargs):
        chatobj.wait_for_new_message(room_id)
        return func(self, chatobj, room_id, *args, **kwargs)

    return _wrapper