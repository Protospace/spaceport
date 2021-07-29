import django, sys, os
os.environ['DJANGO_SETTINGS_MODULE'] = 'apiserver.settings'
django.setup()

from apiserver.api import models

members = models.Member.objects.all()
count = 0

for m in members:
    if m.paused_date and m.status in ['Prepaid', 'Current', 'Due', 'Overdue']:
        print('Setting', m.first_name, m.last_name, 'to Former Member.')
        m.status = 'Former Member'
        count += 1
        m.save()

print('Processed', count)
