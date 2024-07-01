import django, sys, os
os.environ['DJANGO_SETTINGS_MODULE'] = 'apiserver.settings'
django.setup()

import datetime
import json
from apiserver.api import models, utils

def find_name(t):
    try:
        p_info = t['payer_info']
    except KeyError:
        return 'Unknown Name'
    try:
        return p_info['payer_name']['given_name'] + ' ' + p_info['payer_name']['surname']
    except KeyError:
        pass
    try:
        return t['shipping_info']['name']
    except KeyError:
        pass
    try:
        return p_info['payer_name']['alternate_full_name']
    except KeyError:
        return 'Unknown Name'

def build_tx(t):
    t_info = t['transaction_info']
    p_info = t['payer_info']
    amount = float(t_info['transaction_amount']['value'])

    refund_text = 'Refund - ' if amount < 0 else ''

    return dict(
        account_type='PayPal',
        amount=amount,
        date=t_info['transaction_updated_date'].split('T')[0],
        info_source='PayPal IPN',
        payment_method='PayPal',
        paypal_payer_id=t_info['paypal_account_id'],
        paypal_txn_id=t_info['transaction_id'],
        reference_number=t_info['transaction_id'],
        memo=refund_text + t_info.get('transaction_subject', 'no memo') + ' (import missing paypal script)',
    )

def create_unmatched_member_tx(t):
    t_info = t['transaction_info']
    p_info = t['payer_info']
    transactions = models.Transaction.objects

    report_memo = 'Cant link sender name, {}, email: {}, note: {} - {} {}'.format(
        find_name(t),
        p_info['email_address'],
        t_info.get('transaction_subject', ''),
        t_info.get('custom_field', ''),
        '(import missing script)',
    )

    return transactions.create(
        **build_tx(t),
        report_memo=report_memo,
        report_type='Unmatched Member',
    )

def create_member_dues_tx(t, member, num_months):
    transactions = models.Transaction.objects

    # new member 3 for 2 will have to be manual anyway
    if num_months == 11:
        num_months = 12

    user = getattr(member, 'user', None)

    tx = transactions.create(
        **build_tx(t),
        member_id=member.id,
        number_of_membership_months=num_months,
        user=user,
    )
    utils.tally_membership_months(member)
    return tx

def create_unmatched_purchase_tx(t, member):
    t_info = t['transaction_info']
    p_info = t['payer_info']
    transactions = models.Transaction.objects

    user = getattr(member, 'user', None)
    report_memo = 'Unknown payment reason, {}, email: {}, note: {} - {} {}'.format(
        find_name(t),
        p_info['email_address'],
        t_info.get('transaction_subject', ''),
        t_info.get('custom_field', ''),
        '(import missing paypal script)',
    )

    return transactions.create(
        **build_tx(t),
        member_id=member.id,
        report_memo=report_memo,
        report_type='Unmatched Purchase',
        user=user,
    )


PAYPAL_FOLDER = 'missing_paypal/'

transactions = models.Transaction.objects.all()
hints = models.PayPalHint.objects.all()
members = models.Member.objects.all()

paypal_files = os.listdir(PAYPAL_FOLDER)
paypal_json = [x for x in paypal_files if x.endswith('.json')]

if paypal_json:
    print('Found paypal json files:', paypal_json)
else:
    print('Couldnt find any paypal json files in', PAYPAL_FOLDER)
    exit(1)

paypal_txs = []
num_unmatched = 0
num_dues = 0
num_noreason = 0

for filename in paypal_json:
    with open(PAYPAL_FOLDER + filename) as f:
        j = json.load(f)
        paypal_txs.extend(j)

print('Num transactions found:', len(paypal_txs))
print('Importing transactions into portal...')

refs = transactions.values_list('reference_number', flat=True)
existing_ids = set()
for r in refs:
    if r:
        existing_ids.add(r[:11])
print('Populated', len(existing_ids), 'existing IDs.')

for t in paypal_txs:
    t_info = t['transaction_info']

    account_id = t_info.get('paypal_account_id', None)
    if not account_id:
        print('Skipping tx id: {}, no payer (could be bank tx):'.format(
            t_info['transaction_id'],
        ))
        print(t_info)
        print()
        continue

    reference = t_info['transaction_id'][:11]

    if reference in existing_ids:
        print('Skipping tx id:', reference, ', transaction already in portal.')
        print()
        continue
    
    print('Inspecting new tx id:', t_info['transaction_id'])
    print(t)

    existing_ids.add(reference)

    if not hints.filter(account=t_info['paypal_account_id']).exists():
        print('Unable to associate with member, reporting')
        create_unmatched_member_tx(t)
        num_unmatched += 1
        print()
        continue

    amount = float(t_info['transaction_amount']['value'])

    user = hints.get(account=t_info['paypal_account_id']).user
    member = user.member
    print('Found member', member.preferred_name, member.last_name)
    monthly_fees = member.monthly_fees

    if amount.is_integer() and monthly_fees and amount % monthly_fees == 0:
        num_months = int(amount // monthly_fees)
    else:
        num_months = 0

    if num_months:
        print('Amount valid for membership dues, adding months:', num_months)
        create_member_dues_tx(t, member, num_months)
        num_dues += 1
        print()
        continue

    print('Unable to find a reason for payment, reporting')
    create_unmatched_purchase_tx(t, member)
    num_noreason += 1
    print()


print('Num unmatched members:', num_unmatched)
print('Num member dues:', num_dues)
print('Num no reason:', num_noreason)
print('Num skipped:', len(paypal_txs) - num_unmatched - num_dues - num_noreason)
print('Done.')
