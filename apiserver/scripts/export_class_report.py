import django, sys, os
os.environ['DJANGO_SETTINGS_MODULE'] = 'apiserver.settings'
django.setup()

import csv
from apiserver.api import models

sessions = models.Session.objects.filter(datetime__gte='2021-01-01')

with open('output.csv', 'w', newline='') as csvfile:
    fields = ['date', 'name', 'num_students','attended']
    writer = csv.DictWriter(csvfile, fieldnames=fields)

    writer.writeheader()

    for s in sessions:
        writer.writerow(dict(
            date=s.datetime.date(),
            name=s.course.name,
            num_students=s.students.count(),
            attended=s.students.filter(attendance_status='Attended').count(),
        ))

