import datetime
from dateutil import relativedelta

from django.db.models import Sum

from . import models, old_models

def num_months_spanned(d1, d2):
    '''
    Return number of month thresholds two dates span.
    Order of arguments is same as subtraction
    ie. Feb 2, Jan 29 returns 1
    '''
    return (d1.year - d2.year) * 12 + d1.month - d2.month

def num_months_difference(d1, d2):
    '''
    Return number of whole months between two dates.
    Order of arguments is same as subtraction
    ie. Feb 2, Jan 29 returns 0
    '''
    r = relativedelta.relativedelta(d1, d2)
    return r.months + 12 * r.years

def calc_member_status(expire_date, fake_date=None):
    '''
    Return: status, if we should pause them
    '''
    today = fake_date or datetime.date.today()
    difference = num_months_difference(expire_date, today)

    #if today + datetime.timedelta(days=29) < expire_date:
    if difference >= 1:
        return 'Prepaid', False
    elif difference <= -3:
        return 'Overdue', True
    elif difference <= -1:
        return 'Overdue', False
    elif today < expire_date:
        return 'Current', False
    elif today >= expire_date:
        return 'Due', False
    else:
        raise()

def add_months(date, num_months):
    return date + relativedelta.relativedelta(months=num_months)

def fake_missing_membership_months(member):
    '''
    Add fake months on importing the member so the length of their membership
    resolves to their imported expiry date
    '''
    start_date = member.current_start_date
    expire_date = member.expire_date

    missing_months = num_months_spanned(expire_date, start_date)

    user = member.user if member.user else None
    tx = False
    for i in range(missing_months):
        memo = '{} / {} month membership dues accounting old portal import, {} to {} - hidden'.format(
            str(i+1), str(missing_months), start_date, expire_date
        )

        tx = models.Transaction.objects.create(
            amount=0,
            user=user,
            memo=memo,
            member_id=member.id,
            reference_number='',
            info_source='System',
            payment_method='N/A',
            category='Memberships:Fake Months',
            account_type='Clearing',
            number_of_membership_months=1,
            date=add_months(start_date, i),
        )

    return tx

def tally_membership_months(member, fake_date=None):
    '''
    Sum together member's dues and calculate their new expire date and status
    Doesn't work if member is paused.
    '''
    if member.paused_date: return False

    start_date = member.current_start_date
    if not start_date: return False

    txs = models.Transaction.objects.filter(member_id=member.id)
    total_months_agg = txs.aggregate(Sum('number_of_membership_months'))
    total_months = total_months_agg['number_of_membership_months__sum'] or 0

    expire_date = add_months(start_date, total_months)
    status, former = calc_member_status(expire_date, fake_date)

    member.expire_date = expire_date
    member.status = status

    if former:
        member.paused_date = expire_date

    member.save()
    return True
