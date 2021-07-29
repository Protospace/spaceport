# Expects a old_counts.csv of the historical counts in format:
# date,member_count,green_count

import django, sys, os
os.environ['DJANGO_SETTINGS_MODULE'] = 'apiserver.settings'
django.setup()

import csv
from apiserver.api import models

with open('old_counts.csv', newline='') as csvfile:
    reader = csv.DictReader(csvfile)
    for row in reader:
        print('Adding', row['date'], row['member_count'], row['green_count'])

        models.StatsMemberCount.objects.update_or_create(
            date=row['date'],
            defaults=dict(member_count=row['member_count'], green_count=row['green_count']),
        )

print('Done.')
