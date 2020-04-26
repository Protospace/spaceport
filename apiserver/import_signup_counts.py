# Expects a old_counts.csv of the historical counts in format:
# month,signup_count
# month in YYYY-MM format

import django, sys, os
os.environ['DJANGO_SETTINGS_MODULE'] = 'apiserver.settings'
django.setup()

import csv
from apiserver.api import models

with open('old_counts.csv', newline='') as csvfile:
    reader = csv.DictReader(csvfile)
    for row in reader:
        print('Adding', row['month'], row['signup_count'])

        models.StatsSignupCount.objects.update_or_create(
            month=row['month']+'-01',
            defaults=dict(signup_count=row['signup_count']),
        )

print('Done.')
