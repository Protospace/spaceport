import django, sys, os
os.environ['DJANGO_SETTINGS_MODULE'] = 'apiserver.settings'
django.setup()

from django.contrib.auth.models import User

from apiserver.api import models, utils
from uuid import uuid4
import re

random_email = lambda: 'spaceport-' + str(uuid4()).split('-')[0] + '@protospace.ca'

members = models.Member.objects.all()

print('Deleting duplicates...')

for mid in [5203, 5257, 5261, 5277, 5278, 5299, 5307, 5310, 5240]:
    member = models.Member.objects.get(id=mid)
    print('Deleting:', member.first_name, member.last_name)
    member.delete()

print()
print('Generating Users')

count = 0

for member in members:
    if member.user:
        continue

    print('Member', member.id, member.first_name, member.last_name)

    if not member.first_name.isalpha():
        print('    Non-alpha first name.')

    if not member.last_name.isalpha():
        print('    Non-alpha last name.')

    first_name = member.first_name.strip().lower()
    last_name = member.last_name.strip().lower()

    first_name = re.sub(r'[^a-z- ]+', '', first_name)
    last_name = re.sub(r'[^a-z- ]+', '', last_name)

    first_name = first_name.replace(' ', '.').replace('-', '.')
    last_name = last_name.replace(' ', '.').replace('-', '.')

    username = first_name + '.' + last_name
    print('    Username:', username)

    if member.old_email:
        email = member.old_email
    else:
        email = random_email()
        print('    No email, using:', email)

    user = User.objects.create_user(username, email, str(uuid4()))

    member.user = user
    member.save()

    x = models.Transaction.objects.filter(member_id=member.id)
    x.update(user=user)
    print('    Linked', x.count(), 'transactions')

    x = models.Card.objects.filter(member_id=member.id)
    x.update(user=user)
    print('    Linked', x.count(), 'cards')

    x = models.Training.objects.filter(member_id=member.id)
    x.update(user=user)
    print('    Linked', x.count(), 'trainings')

    x = models.PayPalHint.objects.filter(member_id=member.id)
    x.update(user=user)
    print('    Linked', x.count(), 'paypal hints')


    count += 1
    print()

print('Generated', count, 'users.')

print('Deleting orphan cards...')
count = models.Card.objects.filter(user__isnull=True).delete()[0]
print('Deleted', count, 'cards.')

print('Deleting orphan trainings...')
count = models.Training.objects.filter(user__isnull=True).delete()[0]
print('Deleted', count, 'trainings.')

print('Deleting orphan hints...')
count = models.PayPalHint.objects.filter(user__isnull=True).delete()[0]
print('Deleted', count, 'hints.')

print('Done.')
