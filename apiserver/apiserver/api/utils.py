import logging
logger = logging.getLogger(__name__)

import io
import json
import requests
from datetime import datetime, timedelta
from rest_framework.exceptions import ValidationError
from dateutil import relativedelta
from uuid import uuid4
from PIL import Image, ImageDraw, ImageFont, ImageOps
from bleach.sanitizer import Cleaner
from PyPDF2 import PdfFileWriter, PdfFileReader
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import letter

from django.db.models import Sum
from django.core.cache import cache
from django.utils.timezone import now, pytz

from . import models, serializers, utils_ldap

STATIC_FOLDER = 'data/static/'


def today_alberta_tz():
    return datetime.now(pytz.timezone('America/Edmonton')).date()

def alert_tanner(message):
    try:
        logger.info('Alerting Tanner: ' + message)
        params = dict(spaceport=message)
        requests.get('https://tbot.tannercollin.com/message', params=params, timeout=4)
    except BaseException as e:
        logger.error('Problem alerting Tanner: ' + str(e))

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
    today = fake_date or today_alberta_tz()

    difference = num_months_difference(expire_date, today)

    if today + timedelta(days=29) < expire_date:
        return 'Prepaid', False
    elif difference <= -3:
        return 'Overdue', True
    elif today - timedelta(days=29) >= expire_date:
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


def gen_search_strings():
    '''
    Generate a cache dict of names to member ids for rapid string matching
    '''
    search_strings = {}
    for m in models.Member.objects.order_by('-expire_date'):
        string = '{} {}'.format(
            m.preferred_name,
            m.last_name,
        )

        if m.old_email:
            string += '  ' + m.old_email
        if m.user:
            string += '  ' + m.user.email
        string += ' ' + str(m.id)

        string = string.lower()
        search_strings[string] = m.id
    cache.set('search_strings', search_strings)


LARGE_SIZE = 1080
MEDIUM_SIZE = 220
SMALL_SIZE = 110

def process_image_upload(upload, crop):
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

    pic = ImageOps.exif_transpose(pic)

    if crop:
        crop = json.loads(crop)
        pic_x, pic_y = pic.size
        left = pic_x * crop['x']/100.0
        top = pic_y * crop['y']/100.0
        right = left + pic_x * crop['width']/100.0
        bottom = top + pic_y * crop['height']/100.0
        pic = pic.crop((left, top, right, bottom))

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


CARD_TEMPLATE_FILE = 'misc/member_card_template.jpg'
CARD_PHOTO_SIZE = 425
CARD_PHOTO_MARGIN_TOP = 75
CARD_PHOTO_MARGIN_SIDE = 30
CARD_TEXT_SIZE_LIMIT = 550

def gen_card_photo(member):
    card_template = Image.open(CARD_TEMPLATE_FILE)

    member_photo = Image.open(STATIC_FOLDER + member.photo_large)
    member_photo.thumbnail([CARD_PHOTO_SIZE, CARD_PHOTO_SIZE], Image.ANTIALIAS)
    member_photo = ImageOps.expand(member_photo, border=10)
    mx, my = member_photo.size

    x = CARD_PHOTO_MARGIN_SIDE
    y = CARD_PHOTO_MARGIN_TOP
    card_template.paste(member_photo, (x, y))

    draw = ImageDraw.Draw(card_template)

    # check font size
    font_sizes = (60, 72)
    font = ImageFont.truetype('DejaVuSans-Bold.ttf', font_sizes[1])
    size = draw.textsize(member.last_name, font=font)
    if size[0] > CARD_TEXT_SIZE_LIMIT:
        font_sizes = (36, 48)

    font = ImageFont.truetype('DejaVuSans.ttf', font_sizes[0])
    x = CARD_PHOTO_MARGIN_SIDE
    y = my + CARD_PHOTO_MARGIN_TOP + CARD_PHOTO_MARGIN_SIDE
    draw.text((x, y), member.first_name, (0,0,0), font=font)

    font = ImageFont.truetype('DejaVuSans-Bold.ttf', font_sizes[1])
    y = my + CARD_PHOTO_MARGIN_TOP + CARD_PHOTO_MARGIN_SIDE + font_sizes[1]
    draw.text((x, y), member.last_name, (0,0,0), font=font)

    font = ImageFont.truetype('DejaVuSans.ttf', 36)
    draw.text((x, 800), 'Joined: ' + str(member.application_date), (0,0,0), font=font)
    y = CARD_PHOTO_MARGIN_SIDE
    draw.text((475, y), str(member.id), (0,0,0), font=font)

    bio = io.BytesIO()
    card_template.save(bio, 'JPEG', quality=95)
    bio.seek(0)

    return bio


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

    try:
        member = models.Member.objects.get(old_email__iexact=data['email'])
    except models.Member.DoesNotExist:
        msg = 'Unable to find email in old portal. Maybe try your other email addresses?'
        logger.info(msg)
        raise ValidationError(dict(email=msg))
    except models.Member.MultipleObjectsReturned:
        msg = 'Duplicate emails found. Talk to Tanner.'
        logger.info(msg)
        raise ValidationError(dict(email=msg))

    if member.user:
        msg = 'Old member already claimed.'
        logger.info(msg)
        raise ValidationError(dict(email=msg))

    if utils_ldap.is_configured():
        result = utils_ldap.find_user(user.username)
        if result == 200:
            if utils_ldap.set_password(data) != 200:
                msg = 'Problem connecting to LDAP server: set.'
                alert_tanner(msg)
                logger.info(msg)
                raise ValidationError(dict(non_field_errors=msg))
        elif result == 404:
            if utils_ldap.create_user(data) != 200:
                msg = 'Problem connecting to LDAP server: create.'
                alert_tanner(msg)
                logger.info(msg)
                raise ValidationError(dict(non_field_errors=msg))
        else:
            msg = 'Problem connecting to LDAP server: find.'
            alert_tanner(msg)
            logger.info(msg)
            raise ValidationError(dict(non_field_errors=msg))


    member.user = user
    member.first_name = data['first_name'].title()
    member.last_name = data['last_name'].title()
    member.preferred_name = data['first_name'].title()
    member.save()

    models.Transaction.objects.filter(member_id=member.id).update(user=user)
    models.Card.objects.filter(member_id=member.id).update(user=user)
    models.Training.objects.filter(member_id=member.id).update(user=user)

def create_new_member(data, user):
    members = models.Member.objects
    if members.filter(old_email__iexact=data['email']).exists():
        msg = 'Account was found in old portal.'
        logger.info(msg)
        raise ValidationError(dict(email=msg))

    if utils_ldap.is_configured():
        result = utils_ldap.find_user(user.username)
        if result == 200:
            msg = 'Username was found in old portal.'
            logger.info(msg)
            raise ValidationError(dict(username=msg))
        elif result == 404:
            pass
        else:
            msg = 'Problem connecting to LDAP server.'
            alert_tanner(msg)
            logger.info(msg)
            raise ValidationError(dict(non_field_errors=msg))

        if utils_ldap.create_user(data) != 200:
            msg = 'Problem connecting to LDAP server: create.'
            alert_tanner(msg)
            logger.info(msg)
            raise ValidationError(dict(non_field_errors=msg))

    models.Member.objects.create(
        user=user,
        first_name=data['first_name'].title(),
        last_name=data['last_name'].title(),
        preferred_name=data['first_name'].title(),
    )

def register_user(data, user):
    try:
        if data['existing_member'] == 'true':
            logger.info('Linking old member...')
            link_old_member(data, user)
        else:
            logger.info('Creating new member...')
            create_new_member(data, user)
    except:
        user.delete()
        raise

BLANK_FORM = 'misc/blank_member_form.pdf'
def gen_member_forms(member):
    serializer = serializers.MemberSerializer(member)
    data = serializer.data

    packet = io.BytesIO()
    can = canvas.Canvas(packet, pagesize=letter)
    can.drawString(75, 775, '[  ] Paid    [  ] Sponsored & Approved    [  ] Vetted    [  ] Got Card')
    can.drawString(34, 683, data['first_name'])
    can.drawString(218, 683, data['last_name'])
    can.drawString(403, 683, data['preferred_name'])
    can.drawString(34, 626, data['email'])
    can.drawString(332, 626, data['phone'])
    can.drawString(34, 570, data['emergency_contact_name'])
    can.drawString(332, 570, data['emergency_contact_phone'])
    can.save()
    packet.seek(0)
    info_pdf = PdfFileReader(packet)

    packet = io.BytesIO()
    can = canvas.Canvas(packet, pagesize=letter)
    can.drawRightString(600, 775, '{} {} ({})'.format(
        data['first_name'],
        data['last_name'],
        data['id'],
    ))
    can.save()
    packet.seek(0)
    topright_pdf = PdfFileReader(packet)

    existing_pdf = PdfFileReader(open(BLANK_FORM, 'rb'))
    output = PdfFileWriter()
    page = existing_pdf.getPage(0)
    page.mergePage(info_pdf.getPage(0))
    page.mergePage(topright_pdf.getPage(0))
    output.addPage(page)
    page = existing_pdf.getPage(1)
    page.mergePage(topright_pdf.getPage(0))
    output.addPage(page)
    page = existing_pdf.getPage(2)
    page.mergePage(topright_pdf.getPage(0))
    output.addPage(page)

    file_name = str(uuid4()) + '.pdf'
    outputStream = open(STATIC_FOLDER + file_name, 'wb')
    output.write(outputStream)

    member.member_forms = file_name
    member.save()
