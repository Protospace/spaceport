import logging
logger = logging.getLogger(__name__)

import datetime
import json
import requests
from rest_framework.exceptions import ValidationError
from uuid import uuid4

from django.db.models import Sum
from django.utils import timezone
from django.utils.timezone import now

from . import models, serializers, utils
from .. import settings

def build_tx(data):
    amount = float(data.get('mc_gross', 0))
    return dict(
        account_type='PayPal',
        amount=amount,
        date=parse_paypal_date(data.get('payment_date', '')),
        info_source='PayPal IPN',
        payment_method=data.get('payment_type', 'unknown'),
        paypal_payer_id=data.get('payer_id', 'unknown'),
        paypal_txn_id=data.get('txn_id', 'unknown'),
        paypal_txn_type=data.get('txn_type', 'unknown'),
        reference_number=data.get('txn_id', 'unknown'),
    )

def create_unmatched_member_tx(data):
    transactions = models.Transaction.objects

    report_memo = 'Cant link sender name, {} {}, email: {}, note: {} - {}'.format(
        data.get('first_name', 'unknown'),
        data.get('last_name', 'unknown'),
        data.get('payer_email', 'unknown'),
        data.get('custom', 'none'),
        data.get('memo', 'none'),
    )

    tx = transactions.create(
        **build_tx(data),
        report_memo=report_memo,
        report_type='Unmatched Member',
    )

    utils.log_transaction(tx)
    return tx

def create_member_dues_tx(data, member, num_months, deal):
    transactions = models.Transaction.objects

    # new member 3 for 2 will have to be manual anyway
    if deal == 12 and num_months == 11:
        num_months = 12
        deal_str = '12 for 11, '
    elif deal == 3 and num_months == 2:
        num_months = 3
        deal_str = '3 for 2, '
    else:
        deal_str = ''

    user = getattr(member, 'user', None)
    memo = '{}{} {} - Protospace Membership, {}'.format(
        deal_str,
        data.get('first_name', 'unknown'),
        data.get('last_name', 'unknown'),
        data.get('payer_email', 'unknown'),
    )

    tx = transactions.create(
        **build_tx(data),
        memo=memo,
        category='Membership',
        number_of_membership_months=num_months,
        user=user,
    )
    utils.tally_membership_months(member)
    utils.log_transaction(tx)
    return tx

def create_unmatched_purchase_tx(data, member):
    transactions = models.Transaction.objects

    user = getattr(member, 'user', None)
    report_memo = 'Unknown payment reason, {} {}, email: {}, note: {} - {}'.format(
        data.get('first_name', 'unknown'),
        data.get('last_name', 'unknown'),
        data.get('payer_email', 'unknown'),
        data.get('custom', 'none'),
        data.get('memo', 'none'),
    )

    tx = transactions.create(
        **build_tx(data),
        report_memo=report_memo,
        report_type='Unmatched Purchase',
        user=user,
    )

    utils.log_transaction(tx)
    return tx

def create_member_training_tx(data, member, training):
    transactions = models.Transaction.objects

    user = getattr(member, 'user', None)
    memo = '{} {} - {} Course, email: {}, session: {}, training: {}'.format(
        data.get('first_name', 'unknown'),
        data.get('last_name', 'unknown'),
        training.session.course.name,
        data.get('payer_email', 'unknown'),
        str(training.session.id),
        str(training.id),
    )

    tx = transactions.create(
        **build_tx(data),
        category='OnAcct',
        memo=memo,
        user=user,
    )

    utils.log_transaction(tx)
    return tx

def check_training(data, training_id, amount):
    trainings = models.Training.objects

    if not trainings.filter(id=training_id).exists():
        return False

    training = trainings.get(id=training_id)

    #if training.attendance_status != 'Waiting for payment':
    #    return False

    if not training.session:
        return False

    if training.session.is_cancelled:
        return False

    if training.session.cost != amount:
        return False

    member = training.user.member

    if training.attendance_status == 'Waiting for payment':
        training.attendance_status = 'Confirmed'
    training.paid_date = datetime.date.today()
    training.save()

    logger.info('IPN - Amount valid for training cost, id: ' + str(training.id))
    return create_member_training_tx(data, member, training)

def create_category_tx(data, member, custom_json, amount):
    transactions = models.Transaction.objects

    user = getattr(member, 'user', None)
    category = custom_json['category']

    if category == 'Exchange':
        protocoin = amount
        note = '{} Protocoin Purchase'.format(amount)
    else:
        protocoin = 0
        note = custom_json.get('memo', 'none')

    memo = '{} {} - {}, email: {}, note: {}'.format(
        data.get('first_name', 'unknown'),
        data.get('last_name', 'unknown'),
        category,
        data.get('payer_email', 'unknown'),
        note,
    )

    tx = transactions.create(
        **build_tx(data),
        category=category,
        memo=memo,
        user=user,
        protocoin=protocoin,
    )

    utils.log_transaction(tx)
    return tx


def process_square_webhook(data):
    '''
    Receive webhook data from Square.

    Blocks the POST response, so keep it quick.
    '''

    amount = data['total_money']['amount'] / 100.0

    if data['total_money']['currency'] != 'CAD':
        logger.info('Square - Payment currency invalid, ignoring')
        return False

    if data['state'] != 'COMPLETED':
        logger.info('Square - Payment not yet completed, ignoring')
        return False

    if data['location_id'] != 'XR9TVNPEJ44GR':
        logger.info('Square - Payment not for us, ignoring')
        return False

    transactions = models.Transaction.objects
    members = models.Member.objects
    hints = models.PayPalHint.objects
    user = False

    dt = datetime.datetime.strptime(data['created_at'], '%Y-%m-%dT%H:%M:%SZ')
    dt = dt.replace(tzinfo=timezone.utc)

    if transactions.filter(square_txn_id=data['id']).exists():
        logger.info('Square - Duplicate transaction, ignoring')
        return False

    try:
        customer_id = data['tenders'][0].get('customer_id', None)
        user = hints.get(account=customer_id).user
    except models.PayPalHint.DoesNotExist:
        logger.info('Square - No payment hint found for %s', customer_id)

    tx = dict(
        account_type='Square Pmt',
        amount=amount,
        date=dt,
        info_source='Square Webhook',
        payment_method='N/A'
        square_payer_id=customer_id,
        square_txn_id=data['id'],
        reference_number=data['id'],
    )








    if not user:
        logger.info('IPN - Unable to associate with member, reporting')
        update_ipn(ipn, 'Accepted, Unmatched Member')
        return create_unmatched_member_tx(data)







    try:
        custom_json = json.loads(data.get('custom', '').replace('`', '"'))
    except (KeyError, ValueError):
        custom_json = {}

    if 'training' in custom_json:
        tx = check_training(data, custom_json['training'], amount)
        if tx:
            logger.info('IPN - Training matched, adding hint and returning')
            update_ipn(ipn, 'Accepted, training')
            hints.update_or_create(
                account=data.get('payer_id', 'unknown'),
                defaults=dict(user=tx.user),
            )
            return tx

    member = user.member

    hints.update_or_create(
        account=data.get('payer_id', 'unknown'),
        defaults=dict(user=user),
    )

    if custom_json.get('category', False) in ['Snacks', 'OnAcct', 'Donation', 'Consumables', 'Purchases', 'Exchange']:
        logger.info('IPN - Category matched')
        update_ipn(ipn, 'Accepted, category')
        return create_category_tx(data, member, custom_json, amount)

    monthly_fees = member.monthly_fees

    if amount.is_integer() and monthly_fees and amount % monthly_fees == 0:
        num_months = int(amount // monthly_fees)
    else:
        num_months = 0

    if num_months:
        logger.info('IPN - Amount valid for membership dues, adding months')
        update_ipn(ipn, 'Accepted, Member Dues')
        deal = custom_json.get('deal', False)
        return create_member_dues_tx(data, member, num_months, deal)

    logger.info('IPN - Unable to find a reason for payment, reporting')
    update_ipn(ipn, 'Accepted, Unmatched Purchase')
    return create_unmatched_purchase_tx(data, member)
