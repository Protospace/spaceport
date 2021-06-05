import django, sys, os
os.environ['DJANGO_SETTINGS_MODULE'] = 'apiserver.settings'
django.setup()

import csv
from apiserver.api import models

members = models.Member.objects.all()

writer = csv.writer(sys.stdout)

def color(status):
    if status in ['Prepaid', 'Current']:
        return 'Green'
    elif status == 'Due':
        return 'Yellow'
    elif status == 'Overdue':
        return 'Red'
    else:
        return 'Black'

for m in members:
    status = 'Former Member' if m.paused_date else m.status
    writer.writerow([m.id, m.first_name, m.last_name, status, color(status)])
