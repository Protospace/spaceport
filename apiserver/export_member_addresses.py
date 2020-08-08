import django, sys, os
os.environ['DJANGO_SETTINGS_MODULE'] = 'apiserver.settings'
django.setup()

import csv
from apiserver.api import models

members = models.Member.objects.all()

writer = csv.writer(sys.stdout)

for m in members:
    writer.writerow([m.id, m.first_name, m.last_name, m.street_address, m.city, m.postal_code])
