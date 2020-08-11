import django, sys, os
os.environ['DJANGO_SETTINGS_MODULE'] = 'apiserver.settings'
django.setup()

import datetime
import json
from django.utils.timezone import now, pytz
from apiserver.api import models, utils

# Member orientation
print('Updating member orientation dates')
sessions = models.Session.objects.filter(course = 249)

def get_member(obj):
    # same as in serialzers.py -> get_cards for example
    if obj.user:
        member = obj.user.member
    else:
        member = models.Member.objects.get(id=obj.member_id)
    return member


for session in sessions:
    students = models.Training.objects.filter(session = session)
    for student in students:
        if student.attendance_status == 'Attended':
            member = get_member(student)
            if not member.orientation_date:
                member.orientation_date = session.datetime.astimezone(pytz.timezone('America/Edmonton')).date()
                member.save()

# Lathe
print('Updating lathe training dates')
sessions = models.Session.objects.filter(course = 281)

for session in sessions:
    students = models.Training.objects.filter(session = session)
    for student in students:
        if student.attendance_status == 'Attended':
            member = get_member(student)
            if not member.lathe_cert_date:
                member.lathe_cert_date = session.datetime.astimezone(pytz.timezone('America/Edmonton')).date()
                member.save()

# Manual Mill
print('Updating mill training dates')
sessions = models.Session.objects.filter(course = 283)

for session in sessions:
    students = models.Training.objects.filter(session = session)
    for student in students:
        if student.attendance_status == 'Attended':
            member = get_member(student)
            if not member.mill_cert_date:
                member.mill_cert_date = session.datetime.astimezone(pytz.timezone('America/Edmonton')).date()
                member.save()


# Woodworking tools
print('Updating woodworking training dates')
sessions = models.Session.objects.filter(course = 261)

for session in sessions:
    students = models.Training.objects.filter(session = session)
    for student in students:
        if student.attendance_status == 'Attended':
            member = get_member(student)
            if not member.wood_cert_date:
                member.wood_cert_date = session.datetime.astimezone(pytz.timezone('America/Edmonton')).date()
                member.save()

# Woodworking-2 tools
print('Updating woodworking-2 training dates')
sessions = models.Session.objects.filter(course = 401)

for session in sessions:
    students = models.Training.objects.filter(session = session)
    for student in students:
        if student.attendance_status == 'Attended':
            member = get_member(student)
            if not member.wood2_cert_date:
                member.wood2_cert_date = session.datetime.astimezone(pytz.timezone('America/Edmonton')).date()
                member.save()

# CNC tools
print('Updating CNC training dates')
sessions = models.Session.objects.filter(course = 259)

for session in sessions:
    students = models.Training.objects.filter(session = session)
    for student in students:
        if student.attendance_status == 'Attended':
            member = get_member(student)
            if not member.cnc_cert_date:
                member.cnc_cert_date = session.datetime.astimezone(pytz.timezone('America/Edmonton')).date()
                member.save()

print('Done.')
