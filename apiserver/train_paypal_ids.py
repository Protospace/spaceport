import django, sys, os
os.environ['DJANGO_SETTINGS_MODULE'] = 'apiserver.settings'
django.setup()

import datetime
import json
from apiserver.api import models, old_models, utils

PAYPAL_FOLDER = 'old_paypal/'
transactions = models.Transaction.objects.all()

paypal_files = os.listdir(PAYPAL_FOLDER)
paypal_json = [x for x in paypal_files if x.endswith('.json')]

if paypal_json:
    print('Found paypal json files:', paypal_json)
else:
    print('Couldnt find any paypal json files in', PAYPAL_FOLDER)
    exit(1)

paypal_txs = []

for filename in paypal_json:
    with open(PAYPAL_FOLDER + filename) as f:
        j = json.load(f)
        paypal_txs.extend(j['transaction_details'])

print('Num transactions found:', len(paypal_txs))
print('Linking with portal transactions...')

paypal_accounts = {}

for t in paypal_txs:
    t_info = t['transaction_info']


    account_id = t_info.get('paypal_account_id', None)
    if not account_id:
        print('Skipping tx id: {}, no payer (could be bank tx)'.format(
            t_info['transaction_id'],
        ))
        continue

    if account_id not in paypal_accounts:
        paypal_accounts[account_id] = []


    reference = t_info['transaction_id'][:11]
    try:
        portal_tx = transactions.get(reference_number=reference)
        paypal_accounts[account_id].append(portal_tx.member_id)
    except models.Transaction.DoesNotExist:
        print('Unable to find portal transaction for id: {}, ref: {}, date: {}, name: {} {}, email: {}'.format(
            t_info['transaction_id'],
            reference,
            t_info['transaction_initiation_date'][:10],
            t['payer_info']['payer_name'].get('given_name', 'unknown'),
            t['payer_info']['payer_name'].get('surname', 'unknown'),
            t['payer_info'].get('email_address', 'unknown'),
        ))

print('Num paypal accounts found:', len(paypal_accounts))
print('Linking with portal members...')
count = 0

for account_id, member_ids in paypal_accounts.items():
    if len(member_ids) == 0:
        print('Skipping account {}, no members found'.format(
            account_id,
        ))
        continue

    member_id = member_ids[0]

    if len(set(member_ids)) > 1:
        print('Account {} has multiple members {}, assuming {}'.format(
            account_id,
            str(set(member_ids)),
            member_id,
        ))

    print(account_id, '-->', member_id)

    models.PayPalHint.objects.update_or_create(
        account=account_id,
        defaults=dict(member_id=member_id),
    )
    count += 1

print('Num paypal hints processed:', count)
print('Done.')
