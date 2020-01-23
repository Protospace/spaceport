from rest_framework.exceptions import ValidationError
import datetime
from dateutil import relativedelta
from uuid import uuid4
from PIL import Image
from bleach.sanitizer import Cleaner

from django.db.models import Sum

from . import models
try:
    from . import old_models
except ImportError:
    print('Running without old portal data...')
    old_models = None

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

    return tx, missing_months

def tally_membership_months(member, fake_date=None):
    '''
    Sum together member's dues and calculate their new expire date and status
    Doesn't work if member is paused.
    '''
    if member.paused_date: return False

    start_date = member.current_start_date
    if not start_date: return False

    txs = models.Transaction.objects.filter(
        member_id=member.id,
        date__gte=start_date,
    )
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


search_strings = {}
def gen_search_strings():
    '''
    Generate a cache dict of names to member ids for rapid string matching
    '''
    for m in models.Member.objects.all():
        string = '{} {}'.format(
            m.preferred_name,
            m.last_name,
        ).lower()
        search_strings[string] = m.id


STATIC_FOLDER = 'data/static/'
LARGE_SIZE = 1080
MEDIUM_SIZE = 220
SMALL_SIZE = 110

def process_image_upload(upload):
    '''
    Save an image upload in small, medium, large sizes and return filenames
    '''
    try:
        pic = Image.open(upload)
    except OSError:
        raise serializers.ValidationError('Invalid image file.')

    if pic.format == 'PNG':
        ext = '.png'
    elif pic.format == 'JPEG':
        ext = '.jpg'
    else:
        raise serializers.ValidationError('Image must be a jpg or png.')

    large = str(uuid4()) + ext
    pic.thumbnail([LARGE_SIZE, LARGE_SIZE], Image.ANTIALIAS)
    pic.save(STATIC_FOLDER + large)

    medium = str(uuid4()) + ext
    pic.thumbnail([MEDIUM_SIZE, MEDIUM_SIZE], Image.ANTIALIAS)
    pic.save(STATIC_FOLDER + medium)

    small = str(uuid4()) + ext
    pic.thumbnail([SMALL_SIZE, SMALL_SIZE], Image.ANTIALIAS)
    pic.save(STATIC_FOLDER + small)

    return small, medium, large


ALLOWED_TAGS = [
    'h3',
    'p',
    'br',
    'strong',
    'em',
    'u',
    'code',
    'ol',
    'li',
    'ul',
    'a',
]

clean = Cleaner(tags=ALLOWED_TAGS).clean


def is_request_from_protospace(request):
    whitelist = ['24.66.110.96', '205.233.15.76', '205.233.15.69']

    # set (not appended) directly by nginx so we can trust it
    real_ip = request.META.get('HTTP_X_REAL_IP', False)

    return real_ip in whitelist

def link_old_member(data, user):
    '''
    If a member claims they have an account on the old protospace portal,
    go through and link their objects to their new user using the member_id
    found with their email as a hint

    Since this runs AFTER registration, we need to delete the user on any
    failures or else the username will be taken when they try again
    '''
    if not old_models:
        user.delete()
        raise ValidationError(dict(email='Unable to link, old DB wasn\'t imported.'))

    old_members = old_models.Members.objects.using('old_portal')

    try:
        old_member = old_members.get(email=data['email'])
    except old_models.Members.DoesNotExist:
        user.delete()
        raise ValidationError(dict(email='Unable to find email in old database.'))

    member = models.Member.objects.get(id=old_member.id)

    if member.user:
        user.delete()
        raise ValidationError(dict(email='Old member already claimed.'))

    member.user = user
    member.first_name = data['first_name']
    member.last_name = data['last_name']
    member.preferred_name = data['first_name']
    member.save()

    transactions = models.Transaction.objects.filter(member_id=member.id)
    for t in transactions:
        t.user = user
        t.save()

    cards = models.Card.objects.filter(member_id=member.id)
    for c in cards:
        c.user = user
        c.save()

    training = models.Training.objects.filter(member_id=member.id)
    for t in training:
        t.user = user
        t.save()
