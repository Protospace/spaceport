import django, sys, os
os.environ['DJANGO_SETTINGS_MODULE'] = 'apiserver.settings'
django.setup()

import datetime
import json
from django.utils.timezone import now, pytz
from apiserver.api import models, utils

def get_member(obj):
    # same as in serialzers.py -> get_cards for example
    if obj.user:
        member = obj.user.member
    else:
        member = models.Member.objects.get(id=obj.member_id)
    return member

print('Updating embroidery training dates')
sessions = models.Session.objects.filter(course=447)

for session in sessions:
    students = models.Training.objects.filter(session=session)
    for student in students:
        if student.attendance_status == 'Attended':
            member = get_member(student)
            if not member.embroidery_cert_date:
                member.embroidery_cert_date = session.datetime.astimezone(pytz.timezone('America/Edmonton')).date()
                member.save()

print('Done.')
