import django, sys, os
os.environ['DJANGO_SETTINGS_MODULE'] = 'apiserver.settings'
django.setup()

from apiserver.api import models, old_models

MEMBER_FIELDS = [
    'id',
    'preferred_name',
    'phone',
    'current_start_date',
    'application_date',
    'vetted_date',
    'monthly_fees',
    'emergency_contact_name',
    'emergency_contact_phone',
]

TRANSACTION_FIELDS = [
    'id',
    'member_id',
    'date',
    'amount',
    'reference_number',
    'memo',
    'number_of_membership_months',
    'payment_method',
    'category',
    'account_type',
    'info_source',
]

print('Deleting all members...')
models.Member.objects.all().delete()

print('Importing old members...')
old_members = old_models.Members.objects.using('old_portal').all()

for m in old_members:
    new_member = {}

    for f in MEMBER_FIELDS:
        new_member[f] = m.__dict__.get(f, None)

    models.Member.objects.create(**new_member)
    print('Imported #{} - {} {}'.format(
        m.id, m.first_name, m.last_name
    ))


print('Deleting all transactions...')
models.Transaction.objects.all().delete()

print('Importing old transactions...')
old_transactions = old_models.Transactions.objects.using('old_portal').all()

for t in old_transactions:
    new_transaction = {}

    for f in TRANSACTION_FIELDS:
        new_transaction[f] = t.__dict__.get(f, None)

    models.Transaction.objects.create(**new_transaction)
    print('Imported #{} - {} {}'.format(
        t.id, t.member_id, t.category
    ))


print('Done.')
