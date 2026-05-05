# Converts member shelves due to 2026 renovations
# expects .csv file of "Existing ID","New ID","Classification"

import django, sys, os
os.environ['DJANGO_SETTINGS_MODULE'] = 'apiserver.settings'
django.setup()

import csv
from apiserver.api import models

with open('shelf-conversion.csv', newline='') as csvfile:
    reader = csv.DictReader(csvfile)
    for row in reader:
        models.Storage.objects.update_or_create()

        if new:
            print('Added storage:', new_id, ', classification:', classification)
        else:
            print('Converted storage:', old_id, 'to', new_id, ', classification:', classification)

print('Done processing', count, 'shelves.')
