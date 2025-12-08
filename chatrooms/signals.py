# encoding: utf-8

from django.dispatch import Signal, receiver

from .utils.handlers import MessageHandlerFactory

# Сигнал прихода нового сообщения
chat_message_received = Signal()

# Один общий экземпляр обработчика
handler_factory = MessageHandlerFactory()


@receiver(chat_message_received)
def on_chat_message_received(sender, room_id, username, message, date, user=None, **kwargs):
    """
    sender — это ChatView (экземпляр), который послал сигнал.
    """
    handler_factory.handle_message(
        chatview=sender,
        room_id=room_id,
        username=username,
        message=message,
        date=date,
        user=user,
    )