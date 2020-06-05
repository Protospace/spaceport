import django, sys, os
os.environ['DJANGO_SETTINGS_MODULE'] = 'apiserver.settings'
django.setup()

import datetime
import json
from apiserver.api import models, utils

# Member orientation
print("Updating member orientation dates")
sessions = models.Session.objects.filter(course = 249)

for session in sessions:
    students = models.Training.objects.filter(session = session)
    for student in students:
        if student.member_id and student.attendance_status == "Attended":
            member = models.Member.objects.get(pk=student.member_id)
            if not member.orientation_date:
                member.orientation_date = session.datetime
                member.save()

# Lathe
print("Updating lathe training dates")
sessions = models.Session.objects.filter(course = 281)

for session in sessions:
    students = models.Training.objects.filter(session = session)
    for student in students:
        if student.member_id and student.attendance_status == "Attended":
            member = models.Member.objects.get(pk=student.member_id)
            if not member.lathe_cert_date:
                member.lathe_cert_date = session.datetime
                member.save()

# Manual Mill
print("Updating mill training dates")
sessions = models.Session.objects.filter(course = 283)

for session in sessions:
    students = models.Training.objects.filter(session = session)
    for student in students:
        if student.member_id and student.attendance_status == "Attended":
            member = models.Member.objects.get(pk=student.member_id)
            if not member.mill_cert_date:
                member.mill_cert_date = session.datetime
                member.save()


# Woodworking tools
print("Updating woodworking training dates")
sessions = models.Session.objects.filter(course = 261)

for session in sessions:
    students = models.Training.objects.filter(session = session)
    for student in students:
        if student.member_id and student.attendance_status == "Attended":
            member = models.Member.objects.get(pk=student.member_id)
            if not member.wood_cert_date:
                member.wood_cert_date = session.datetime
                member.save()

print('Done.')
