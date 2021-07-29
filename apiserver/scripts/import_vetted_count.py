# Expects a old_counts.csv of the historical counts in format:
# date,vetted_count

import django, sys, os
os.environ['DJANGO_SETTINGS_MODULE'] = 'apiserver.settings'
django.setup()

import csv
from apiserver.api import models

with open('old_counts.csv', newline='') as csvfile:
    reader = csv.DictReader(csvfile)
    for row in reader:
        print('Adding', row['date'], row['vetted_count'])

        models.StatsMemberCount.objects.update_or_create(
            date=row['date'],
            defaults=dict(vetted_count=row['vetted_count']),
        )

print('Done.')
