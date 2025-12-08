# encoding: utf-8

from dataclasses import dataclass
from datetime import datetime


@dataclass
class MessageWrapper:
    """Простая структура для хранения сообщения."""
    username: str
    content: str
    date: datetime


class MessageHandlerFactory:
    """
    Упрощённая фабрика/обработчик сообщений.
    Никаких динамических импортов, всё в памяти.
    """

    def __init__(self):
        # никаких внешних хендлеров не грузим
        pass

    def handle_message(self, chatview, room_id, username, message, date, user=None):
        """
        Вызывается из сигнала при получении нового сообщения.
        chatview — это экземпляр ChatView (sender в сигнале).
        """
        msg_id = chatview.get_next_message_id(room_id)
        msg = MessageWrapper(username=username, content=message, date=date)
        chatview.get_messages_queue(room_id).append((msg_id, msg))
        chatview.signal_new_message_event(room_id)

    def retrieve_messages(self, chatview, room_id, latest_msg_id):
        """
        Возвращает все сообщения комнаты.
        Фильтрация по latest_msg_id делается в ChatView.get_messages.
        """
        return list(chatview.get_messages_queue(room_id))

    def get_latest_message_id(self, chatview, room_id):
        """
        Возвращает id последнего сообщения.
        """
        queue = chatview.get_messages_queue(room_id)
        if not queue:
            return 0
        return queue[-1][0]