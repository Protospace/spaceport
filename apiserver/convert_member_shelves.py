# Converts member shelves due to 2026 renovations
# expects .csv file of "Existing ID","New ID","Classification"

import django, sys, os
os.environ['DJANGO_SETTINGS_MODULE'] = 'apiserver.settings'
django.setup()

import csv
from apiserver.api import models

# Read all changes into memory to handle shelf ID swaps
changes = []
with open('shelf-conversion.csv', newline='') as csvfile:
    reader = csv.DictReader(csvfile)
    for row in reader:
        changes.append(row)

TEMP_SUFFIX = '_temp_shelf_conversion'

# Pass 1: Rename existing shelves to temporary IDs to avoid unique constraint violations
for row in changes:
    old_id = row['Existing ID']
    if old_id:
        try:
            storage = models.StorageSpace.objects.get(shelf_id=old_id)
            storage.shelf_id = old_id + TEMP_SUFFIX
            storage.save()
        except models.StorageSpace.DoesNotExist:
            # We will report an error in pass 2
            pass

# Pass 2: Create new shelves, and rename temporary shelves to their new IDs
count = 0
for row in changes:
    old_id = row['Existing ID']
    new_id = row['New ID']
    classification = row['Classification']

    if not old_id:
        # Create new shelf
        _, created = models.StorageSpace.objects.update_or_create(
            shelf_id=new_id,
            defaults={'classification': classification}
        )
        if created:
            print('Added storage:', new_id, ', classification:', classification)
        else:
            print('Updated existing storage:', new_id, ', classification:', classification)
    else:
        # Convert existing shelf from temporary ID
        try:
            storage = models.StorageSpace.objects.get(shelf_id=old_id + TEMP_SUFFIX)
            storage.shelf_id = new_id
            storage.classification = classification
            storage.save()
            print('Converted storage:', old_id, 'to', new_id, ', classification:', classification)
        except models.StorageSpace.DoesNotExist:
            print('ERROR: Could not find storage to convert:', old_id)

    count += 1

print('Done processing', count, 'shelves.')
