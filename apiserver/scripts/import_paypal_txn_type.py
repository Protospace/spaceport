import django, sys, os
os.environ['DJANGO_SETTINGS_MODULE'] = 'apiserver.settings'
django.setup()

from urllib.parse import parse_qs

from apiserver.api import models

ipns = models.IPN.objects.all()
transactions = models.Transaction.objects.filter(paypal_txn_id__isnull=False)
txs = {}

for tx in transactions:
    txs[tx.paypal_txn_id] = tx

for ipn in ipns:
    data = parse_qs(ipn.data)

    if data.get('payment_status', [False])[0] != 'Completed':
        continue

    txn_id = data['txn_id'][0]
    txn_type = data['txn_type'][0]

    print('Processing tx id:', txn_id, '| type:', txn_type)

    txs[txn_id].paypal_txn_type = txn_type

print('Performing bulk update...')
transactions.bulk_update(txs.values(), ['paypal_txn_type'])

print('Processed', ipns.count(), 'IPNs.')

print('Done.')
