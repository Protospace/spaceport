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

SANDBOX = False
if SANDBOX:
    VERIFY_URL = 'https://ipnpb.sandbox.paypal.com/cgi-bin/webscr'
    OUR_EMAIL = 'seller@paypalsandbox.com'
    OUR_CURRENCY = 'USD'
else:
    VERIFY_URL = 'https://ipnpb.paypal.com/cgi-bin/webscr'
    OUR_EMAIL = 'paypal@protospace.ca'
    OUR_CURRENCY = 'CAD'

def parse_paypal_date(string):
    '''
    Convert paypal date string into python datetime. PayPal's a bunch of idiots.
    Their API returns dates in some custom format, so we have to parse it.

    Stolen from:
    https://github.com/spookylukey/django-paypal/blob/master/paypal/standard/forms.py

    Return the UTC python datetime.
    '''
    MONTHS = [
        'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug',
        'Sep', 'Oct', 'Nov', 'Dec',
    ]

    if not string: return now()

    value = string.strip()
    try:
        time_part, month_part, day_part, year_part, zone_part = value.split()
        month_part = month_part.strip('.')
        day_part = day_part.strip(',')
        month = MONTHS.index(month_part) + 1
        day = int(day_part)
        year = int(year_part)
        hour, minute, second = map(int, time_part.split(':'))
        dt = datetime.datetime(year, month, day, hour, minute, second)
    except ValueError as e:
        raise ValidationError('Invalid date format {} {}'.format(
            value, str(e)
        ))

    if zone_part in ['PDT', 'PST']:
        # PST/PDT is 'US/Pacific' and ignored, localize only cares about date
        dt = timezone.pytz.timezone('US/Pacific').localize(dt)
        dt = dt.astimezone(timezone.pytz.UTC)
    else:
        raise ValidationError('Bad timezone: ' + zone_part)
    return dt

def record_ipn(data):
    '''
    Record each individual IPN (even dupes) for logging and debugging
    '''
    return models.IPN.objects.create(
        data=data.urlencode(),
        status='New',
    )

def update_ipn(ipn, status):
    ipn.status = status
    ipn.save()

def verify_paypal_ipn(data):
    params = data.copy()
    params['cmd'] = '_notify-validate'
    headers = {
        'content-type': 'application/x-www-form-urlencoded',
        'user-agent': 'spaceport',
    }

    try:
        r = requests.post(VERIFY_URL, params=params, headers=headers, timeout=2)
        r.raise_for_status()
        if r.text != 'VERIFIED':
            return False
    except BaseException as e:
        logger.error('IPN verify - {} - {}'.format(e.__class__.__name__, str(e)))
        return False

    return True

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
        reference_number=data.get('txn_id', 'unknown'),
    )

def create_unmatched_member_tx(data):
    transactions = models.Transaction.objects

    report_memo = 'Cant link sender name, {} {}, email: {}, note: {}'.format(
        data.get('first_name', 'unknown'),
        data.get('last_name', 'unknown'),
        data.get('payer_email', 'unknown'),
        data.get('custom', 'none'),
    )

    return transactions.create(
        **build_tx(data),
        report_memo=report_memo,
        report_type='Unmatched Member',
    )

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
        member_id=member.id,
        memo=memo,
        category='Membership',
        number_of_membership_months=num_months,
        user=user,
    )
    utils.tally_membership_months(member)
    return tx

def create_unmatched_purchase_tx(data, member):
    transactions = models.Transaction.objects

    user = getattr(member, 'user', None)
    report_memo = 'Unknown payment reason, {} {}, email: {}, note: {}'.format(
        data.get('first_name', 'unknown'),
        data.get('last_name', 'unknown'),
        data.get('payer_email', 'unknown'),
        data.get('custom', 'none'),
    )

    return transactions.create(
        **build_tx(data),
        member_id=member.id,
        report_memo=report_memo,
        report_type='Unmatched Purchase',
        user=user,
    )

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

    return transactions.create(
        **build_tx(data),
        member_id=member.id,
        category='OnAcct',
        memo=memo,
        user=user,
    )

def check_training(data, training_id, amount):
    trainings = models.Training.objects

    if not trainings.filter(id=training_id).exists():
        return False

    training = trainings.get(id=training_id)

    if training.attendance_status != 'Waiting for payment':
        return False

    if not training.session:
        return False

    if training.session.is_cancelled:
        return False

    if training.session.cost != amount:
        return False

    if not training.user:
        return False

    member = training.user.member

    training.attendance_status = 'Confirmed'
    training.paid_date = datetime.date.today()
    training.save()

    logger.info('IPN - Amount valid for training cost, id: ' + str(training.id))
    return create_member_training_tx(data, member, training)

def create_category_tx(data, member, custom_json):
    transactions = models.Transaction.objects

    user = getattr(member, 'user', None)
    memo = '{} {} - {}, email: {}, note: {}'.format(
        data.get('first_name', 'unknown'),
        data.get('last_name', 'unknown'),
        custom_json['category'],
        data.get('payer_email', 'unknown'),
        custom_json.get('memo', 'none'),
    )

    return transactions.create(
        **build_tx(data),
        member_id=member.id,
        category=custom_json['category'],
        memo=memo,
        user=user,
    )


def process_paypal_ipn(data):
    '''
    Receive IPN from PayPal, then verify it. If it's good, try to associate it
    with a member. If the value is a multiple of member dues, credit that many
    months of membership. Ignore if payment incomplete or duplicate IPN.

    Blocks the IPN POST response, so keep it quick.
    '''
    ipn = record_ipn(data)

    if verify_paypal_ipn(data):
        logger.info('IPN - verified')
    else:
        logger.error('IPN - verification failed')
        update_ipn(ipn, 'Verification Failed')
        return False

    amount = float(data.get('mc_gross', '0'))

    if data.get('payment_status', 'unknown') != 'Completed':
        logger.info('IPN - Payment not yet completed, ignoring')
        update_ipn(ipn, 'Payment Incomplete')
        return False

    if data.get('receiver_email', 'unknown') != OUR_EMAIL:
        logger.info('IPN - Payment not for us, ignoring')
        update_ipn(ipn, 'Invalid Receiver')
        return False

    if data.get('mc_currency', 'unknown') != OUR_CURRENCY:
        logger.info('IPN - Payment currency invalid, ignoring')
        update_ipn(ipn, 'Invalid Currency')
        return False

    transactions = models.Transaction.objects
    members = models.Member.objects
    hints = models.PayPalHint.objects

    if 'txn_id' not in data:
        logger.info('IPN - Missing transaction ID, ignoring')
        update_ipn(ipn, 'Missing ID')
        return False

    if transactions.filter(paypal_txn_id=data['txn_id']).exists():
        logger.info('IPN - Duplicate transaction, ignoring')
        update_ipn(ipn, 'Duplicate')
        return False

    try:
        custom_json = json.loads(data.get('custom', ''))
    except (KeyError, ValueError):
        custom_json = {}

    if 'training' in custom_json:
        tx = check_training(data, custom_json['training'], amount)
        if tx:
            logger.info('IPN - Training matched, adding hint and returning')
            update_ipn(ipn, 'Accepted, training')
            hints.update_or_create(
                account=data.get('payer_id', 'unknown'),
                defaults=dict(member_id=tx.member_id),
            )
            return tx

    member_id = False

    if not member_id and hints.filter(account=data.get('payer_id', False)).exists():
        member_id = hints.get(account=data['payer_id']).member_id

    if not member_id and 'member' in custom_json:
        member_id = custom_json['member']
        hints.update_or_create(
            account=data.get('payer_id', 'unknown'),
            defaults=dict(member_id=member_id),
        )

    if not members.filter(id=member_id).exists():
        logger.info('IPN - Unable to associate with member, reporting')
        update_ipn(ipn, 'Accepted, Unmatched Member')
        return create_unmatched_member_tx(data)

    member = members.get(id=member_id)

    if custom_json.get('category', False) in ['Snacks', 'OnAcct', 'Donation']:
        logger.info('IPN - Category matched')
        update_ipn(ipn, 'Accepted, category')
        return create_category_tx(data, member, custom_json)

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
