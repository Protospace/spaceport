import datetime
from dateutil import relativedelta

from django.db.models import Sum

from . import models, old_models

def num_months_spanned(d1, d2):
    '''
    Return number of months thresholds two dates span.
    Order of arguments is same as subtraction
    '''
    return (d1.year - d2.year) * 12 + d1.month - d2.month

def num_months_difference(d1, d2):
    '''
    Return number of whole months between two dates.
    Order of arguments is same as subtraction
    '''
    r = relativedelta.relativedelta(d1, d2)
    return r.months + 12 * r.years

def calc_member_status(expire_date):
    today = datetime.date.today()
    difference = num_months_difference(expire_date, today)

    if difference >= 1:
        return 'Prepaid'
    elif difference <= -3:
        return 'Former Member'
    elif difference <= -1:
        return 'Overdue'
    elif today <= expire_date:
        return 'Current'
    elif today > expire_date:
        return 'Due'
    else:
        raise()

def add_months(date, num_months):
    return date + relativedelta.relativedelta(months=num_months)

def fake_missing_membership_months(member):
    '''
    Return a transaction adding fake months on importing the member so the
    length of their membership resolves to their imported expiry date
    '''
    start_date = member.current_start_date
    expire_date = member.expire_date

    missing_months = num_months_spanned(expire_date, start_date)

    user = member.user if member.user else None
    memo = '{} mth membership dues accounting old portal import, {} to {}'.format(
        str(missing_months), start_date, expire_date
    )

    tx = models.Transaction.objects.create(
        amount=0,
        user=user,
        memo=memo,
        member_id=member.id,
        reference_number='',
        info_source='System',
        payment_method='N/A',
        category='Membership',
        account_type='Clearing',
        number_of_membership_months=missing_months,
    )

    return tx

def tally_membership_months(member):
    '''
    Sum together member's dues and calculate their new expire date and status
    Doesn't work if member is paused.
    '''
    if member.paused_date: return False

    start_date = member.current_start_date

    txs = models.Transaction.objects.filter(member_id=member.id)
    total_months_agg = txs.aggregate(Sum('number_of_membership_months'))
    total_months = total_months_agg['number_of_membership_months__sum']

    expire_date = add_months(start_date, total_months)
    status = calc_member_status(expire_date)

    member.expire_date = expire_date
    member.status = status

    if status == 'Former Member':
        member.paused_date = expire_date

    member.save()
    return True
