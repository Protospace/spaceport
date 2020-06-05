import django, sys, os
os.environ['DJANGO_SETTINGS_MODULE'] = 'apiserver.settings'
django.setup()

import datetime
import json
from apiserver.api import models, utils

sessions = models.Session.objects.all()

for session in sessions:
    print("ID: {}".format(session.id))
    students = models.Training.objects.filter(session = session)
    for student in students:
        if not student.user and student.member_id:
            member = models.Member.objects.get(pk=student.member_id)
            student.user = member.user
            student.save()
        if student.user and not student.member_id:
            member = models.Member.objects.get(user=student.user)
            student.member_id = member.id
            student.save()
        print("\tStudent: {} ({})".format(student.user,student.member_id))

print('Done.')
