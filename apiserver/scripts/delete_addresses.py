import django, sys, os
os.environ['DJANGO_SETTINGS_MODULE'] = 'apiserver.settings'
django.setup()

from apiserver.api import models

print('Deleting member object addresses...')

result = models.Member.objects.update(
    street_address='',
    postal_code='',
    city='',
)

print(result, 'rows affected')
print()

print('Scrubbing history...')

result = models.Member.history.update(
    street_address='',
    postal_code='',
    city='',
)

print(result, 'rows affected')
print()

print('Deleting historical changes...')

address_fields = ['street_address', 'postal_code', 'city']
result = models.HistoryChange.objects.filter(field__in=address_fields).update(
    old='',
    new='',
)

print(result, 'rows affected')
print()

print('Done.')
