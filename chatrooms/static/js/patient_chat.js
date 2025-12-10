// chatrooms/static/js/patient_chat.js
// простой пример, roomId делаем глобальной переменной
let roomId = null;
let patientChatSocket = null;

function appendPatientChatMessage(message, username, timestamp) {
    const box = $('#patient-chat-messages');
    if (!box.length) return;

    const safeUser = $('<div>').text(username).html();
    const safeMsg = $('<div>').text(message).html();
    const time = timestamp || new Date().toLocaleTimeString();

    box.append(
        `<div class="mb-1">
           <strong>${safeUser}</strong> <small class="text-muted">${time}</small><br>
           <span>${safeMsg}</span>
         </div>`
    );
    box.scrollTop(box[0].scrollHeight);
}

function connectPatientChat(wsUrl) {
    // wsUrl ожидаем вида: ws://host/ws/patient-chat/<room_id>/
    if (patientChatSocket) {
        patientChatSocket.close();
    }

    patientChatSocket = new WebSocket(wsUrl);

    patientChatSocket.onopen = function () {
        console.log("Patient chat WebSocket connected");
    };

    patientChatSocket.onmessage = function (event) {
        const data = JSON.parse(event.data);
        // формат сообщения должен совпадать с тем, что шлёт consumer
        // здесь предполагаем: {type: 'chat.message', message, username, timestamp}
        if (data.type === 'chat.message') {
            appendPatientChatMessage(data.message, data.username, data.timestamp);
        }
    };

    patientChatSocket.onclose = function () {
        console.log("Patient chat WebSocket closed");
    };

    patientChatSocket.onerror = function (e) {
        console.error("Patient chat WebSocket error:", e);
    };
}

$(function () {
    // Открытие окна чата
    $('#open-patient-chat-btn').on('click', function () {
        $('#patient-chat-popup').show();

        // ⚠️ ВРЕМЕННО: roomId жёстко захардкожен или проставляется здесь.
        // Потом ты здесь будешь получать конкретный room_id через API,
        // например /chat/patient/<patient_id>/open_or_create/
        //
        // Пример:
        // $.post('/chat/patient/open_or_create/', {patient_id: ...})
        //   .done(function (data) {
        //       roomId = data.room_id;
        //       connectPatientChat(`ws://${window.location.host}/ws/patient-chat/${roomId}/`);
        //   });
        //
        // Сейчас можно руками поставить roomId, чтобы проверить работу WebSocket:
        // roomId = 1;
        // connectPatientChat(`ws://${window.location.host}/ws/patient-chat/${roomId}/`);
    });

    // Закрытие окна чата
    $('#close-patient-chat-btn').on('click', function () {
        $('#patient-chat-popup').hide();
    });

    // Отправка сообщения
    $('#patient-chat-form').on('submit', function (e) {
        e.preventDefault();
        const input = $('#patient-chat-input');
        const msg = input.val().trim();
        if (!msg) return;

        if (!patientChatSocket || patientChatSocket.readyState !== WebSocket.OPEN) {
            alert("Chat is not connected");
            return;
        }

        patientChatSocket.send(JSON.stringify({message: msg}));
        input.val('');
    });

    // Обработчик инвайта
    $('#invite-btn').on('click', function () {
        if (!roomId) {
            alert("Open a chat first");
            return;
        }
        const username = $('#invite-username').val().trim();
        if (!username) return;

        $.post(`/chat/patient/${roomId}/invite/`, {username: username})
          .done(function (data) {
              alert(`User ${data.added} invited`);
              $('#invite-username').val('');
          })
          .fail(function (xhr) {
              let msg = "Error";
              try {
                  const r = JSON.parse(xhr.responseText);
                  if (r.error) msg = r.error;
              } catch (e) {}
              alert(msg);
          });
    });
});