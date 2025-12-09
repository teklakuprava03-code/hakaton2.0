#encoding=utf8

from django.urls import reverse
from django.http import HttpResponseRedirect
from django.views.generic import ListView, DetailView, FormView

from .utils.auth import get_login_url
from .forms.guest import GuestNameForm
from .models import Room

import json

from django.contrib.auth.decorators import login_required
from django.http import JsonResponse, HttpResponseForbidden
from django.shortcuts import get_object_or_404
from django.views.decorators.http import require_GET, require_POST

from hospital.models import Patient
from .models import PatientChatRoom, PatientChatMessage
from hospital import models as hospital_models
from hospital.views import is_doctor, is_patient


class RoomsListView(ListView):
    """View to show the list of rooms available """
    context_object_name = "rooms"
    template_name = "chatrooms/rooms_list.html"
    paginate_by = 20

    def get_queryset(self):
        filters = {}
        if self.request.user.is_anonymous:
            filters['allow_anonymous_access'] = True
        return Room.objects.filter(**filters)


class RoomView(DetailView):
    """View for the single room """
    model = Room
    context_object_name = 'room'
    template_name = "chatrooms/room.html"


class GuestNameView(FormView):
    """Shows the form to choose a guest name to anonymous users """
    form_class = GuestNameForm
    template_name = 'chatrooms/guestname_form.html'

    def get_context_data(self, **kwargs):
        kwargs.update(super(GuestNameView, self).get_context_data(**kwargs))
        room_slug = self.request.GET.get('room_slug')
        next = ''
        if room_slug:
            next = reverse('room_view', kwargs={'slug': room_slug})
        kwargs['login_url'] = get_login_url(next)
        return kwargs

    def get_initial(self):
        init = super(GuestNameView, self).get_initial()
        room_slug = self.request.GET.get('room_slug')
        if room_slug:
            init.update(room_slug=room_slug)
        return init

    def form_valid(self, form):
        guest_name = form.cleaned_data.get('guest_name')
        room_slug = form.cleaned_data.get('room_slug')
        self.request.session['guest_name'] = guest_name
        if room_slug:
            redirect_url = reverse('room_view', kwargs={'slug': room_slug})
        else:
            redirect_url = reverse('rooms_list')
        return HttpResponseRedirect(redirect_url)


def get_or_create_patient_room_for_doctor(doctor_user):
    """
    Для текущего врача: находит всех его пациентов и создаёт для каждого чат-рум.
    Возвращает queryset комнат.
    """
    # Пациенты, назначенные этому врачу
    patients = hospital_models.Patient.objects.filter(
        status=True,
        assignedDoctorId=doctor_user.id  # у тебя это поле — int, а не FK
    )

    rooms = []
    for patient in patients:
        room, created = PatientChatRoom.objects.get_or_create(patient=patient)
        # Участники: врач и сам пациент
        room.participants.add(doctor_user)
        if patient.user:  # у Patient есть user
            room.participants.add(patient.user)
        rooms.append(room)
    return rooms

@login_required
@require_GET
def my_patient_rooms(request):
    user = request.user

    # Если врач — чаты по его пациентам
    if is_doctor(user):
        rooms = get_or_create_patient_room_for_doctor(user)
    # Если пациент — только его собственная комната
    elif is_patient(user):
        try:
            patient = hospital_models.Patient.objects.get(user=user)
        except hospital_models.Patient.DoesNotExist:
            return JsonResponse({"rooms": []})
        room, _ = PatientChatRoom.objects.get_or_create(patient=patient)
        room.participants.add(user)
        rooms = [room]
    else:
        return JsonResponse({"rooms": []})

    data = []
    for room in rooms:
        patient = room.patient
        patient_name = getattr(patient, 'get_name', None)
        if callable(patient_name):
            patient_name = patient.get_name()
        elif patient.user:
            patient_name = patient.user.get_full_name() or patient.user.username
        else:
            patient_name = f'Patient #{patient.id}'

        data.append({
            "id": room.id,
            "patient_name": patient_name,
        })

    return JsonResponse({"rooms": data})


@login_required
@require_GET
def patient_chat_messages(request, room_id):
    room = get_object_or_404(PatientChatRoom, id=room_id)

    # доступ только участникам
    if request.user not in room.participants.all():
        return HttpResponseForbidden("Not allowed")

    # последние 50 сообщений
    msgs = room.messages.select_related('sender').order_by('-created_at')[:50]
    msgs = list(msgs)[::-1]  # разворачиваем в хронологическом порядке

    data = []
    for m in msgs:
        data.append({
            "id": m.id,
            "sender": m.sender.get_full_name() or m.sender.username,
            "content": m.content,
            "created_at": m.created_at.isoformat(),
            "is_me": m.sender_id == request.user.id,
        })

    return JsonResponse({"messages": data})


from django.contrib.auth import get_user_model
User = get_user_model()


@login_required
@require_POST
def invite_to_patient_chat(request, room_id):
    room = get_object_or_404(PatientChatRoom, id=room_id)

    # только участник может приглашать
    if request.user not in room.participants.all():
        return HttpResponseForbidden("Not allowed")

    try:
        body = json.loads(request.body.decode('utf-8'))
    except Exception:
        body = request.POST

    user_id = body.get('user_id')
    if not user_id:
        return JsonResponse({"error": "user_id required"}, status=400)

    invited_user = get_object_or_404(User, id=user_id)
    room.participants.add(invited_user)

    return JsonResponse({"status": "ok"})
