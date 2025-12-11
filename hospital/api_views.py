# hospital/api_views.py
from django.http import JsonResponse
from django.contrib.auth.decorators import login_required, user_passes_test
from .models import Patient

def is_doctor(user):
    return user.groups.filter(name='DOCTOR').exists()

@login_required
@user_passes_test(is_doctor)
def api_patients(request):
    patients = Patient.objects.filter(status=True, assignedDoctorId=request.user.id)
    data = [
        {
            "id": p.id,
            "name": p.get_name,
            "mobile": p.mobile,
            "address": p.address,
            "symptoms": p.symptoms,
        }
        for p in patients
    ]
    return JsonResponse(data, safe=False)