# Expects a scans.csv of the historical scans in format:
# date,card_number

import django, sys, os
os.environ['DJANGO_SETTINGS_MODULE'] = 'apiserver.settings'
django.setup()

import csv
from datetime import datetime
from apiserver.api import models
from django.utils.timezone import now, pytz

days = {}

with open('scans.csv', newline='') as csvfile:
    reader = csv.DictReader(csvfile)
    for row in reader:
        datetime_obj = datetime.strptime(row['date'], "%Y-%m-%d %H:%M:%S")
        datetime_obj_utc = datetime_obj.replace(tzinfo=pytz.timezone('UTC'))
        date = datetime_obj_utc.astimezone(pytz.timezone('America/Edmonton'))

        card = row['card_number']

        print('Processing', date, card)
        day = str(date.date())

        if day not in days:
            days[day] = set()

        days[day].add(card)

print(days)

for day, cards in days.items():
    print(day, len(cards))

    models.StatsSpaceActivity.objects.update_or_create(
        date=day,
        defaults=dict(card_scans=len(cards)),
    )

print('Done.')

