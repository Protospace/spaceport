import logging
logger = logging.getLogger(__name__)

import time
from datetime import date, datetime, timedelta
import requests
from django.db.models import Prefetch
from django.core.cache import cache
from django.utils.timezone import now, pytz
from apiserver.api import models, utils
from apiserver import secrets

DEFAULTS = {
    'last_card_change': time.time(),
    'next_meeting': None,
    'next_clean': None,
    'next_class': None,
    'prev_class': None,
    'member_count': None,
    'paused_count': None,
    'green_count': None,
    'bay_108_temp': None,
    'bay_110_temp': None,
    'minecraft_players': [],
    'card_scans': 0,
    'track': {},
    'alarm': {},
    'sign': '',
    'link': '',
    'autoscan': '',
    'last_scan': {},
}

if secrets.MUMBLE:
    DEFAULTS['mumble_users'] = []

def changed_card():
    '''
    Called whenever the card list could change, ie. cards added, modified, or
    user status becoming overdue by 3 months
    '''
    cache.set('last_card_change', time.time())

def calc_next_events():
    sessions = models.Session.objects

    # TODO, go by tag?
    member_meeting = sessions.filter(is_cancelled=False, course__in=[317, 413], datetime__gte=now()).first()
    monthly_clean = sessions.filter(is_cancelled=False, course=273, datetime__gte=now()).first()
    next_class = sessions.exclude(course__in=[317, 413, 273]).filter(is_cancelled=False, datetime__gte=now()).order_by('datetime').first()
    prev_class = sessions.exclude(course__in=[317, 413, 273]).filter(is_cancelled=False, datetime__lte=now()).order_by('datetime').last()

    if member_meeting:
        cache.set('next_meeting', member_meeting.datetime)
    else:
        cache.set('next_meeting', None)

    if monthly_clean:
        cache.set('next_clean', monthly_clean.datetime)
    else:
        cache.set('next_clean', None)

    if next_class:
        cache.set('next_class', dict(datetime=next_class.datetime, id=next_class.id, name=next_class.course.name))
    else:
        cache.set('next_class', None)

    if prev_class:
        cache.set('prev_class', dict(datetime=prev_class.datetime, id=prev_class.id, name=prev_class.course.name))
    else:
        cache.set('prev_class', None)


def calc_member_counts():
    members = models.Member.objects
    not_paused = members.filter(paused_date__isnull=True)

    num_current = not_paused.filter(status='Current').count()
    num_prepaid = not_paused.filter(status='Prepaid').count()
    num_due = not_paused.filter(status='Due').count()
    num_overdue = not_paused.filter(status='Overdue').count()

    member_count = num_current + num_prepaid + num_due + num_overdue
    paused_count = members.count() - member_count
    green_count = num_current + num_prepaid

    six_months_ago = utils.today_alberta_tz() - timedelta(days=183)
    six_month_plus_count = not_paused.filter(application_date__lte=six_months_ago).count()

    vetted_count = not_paused.filter(vetted_date__isnull=False).count()

    related_membership_tx = Prefetch(
        'user__transactions',
        queryset=models.Transaction.objects.exclude(
            number_of_membership_months=0,
        ).exclude(
            number_of_membership_months__isnull=True,
        ),
    )

    subscriber_count = 0
    for member in not_paused.prefetch_related(related_membership_tx):
        if not member.user.transactions.count():
            continue
        if member.user.transactions.latest('date').paypal_txn_type == 'subscr_payment':
            subscriber_count += 1

    cache.set('member_count', member_count)
    cache.set('paused_count', paused_count)
    cache.set('green_count', green_count)

    return dict(
        member_count=member_count,
        green_count=green_count,
        six_month_plus_count=six_month_plus_count,
        vetted_count=vetted_count,
        subscriber_count=subscriber_count,
    )

def calc_signup_counts():
    month_beginning = utils.today_alberta_tz().replace(day=1)

    members = models.Member.objects
    new_members = members.filter(application_date__gte=month_beginning)
    num_new_members = new_members.count()

    return num_new_members

def calc_retain_counts():
    signup_counts = models.StatsSignupCount.objects.all()

    all_members = models.Member.objects
    active_members = all_members.filter(paused_date__isnull=True)
    vetted_members = all_members.filter(vetted_date__isnull=False)

    for entry in signup_counts:
        date = entry.month
        active_new_members = active_members.filter(
            application_date__month=date.month, application_date__year=date.year
        )
        vetted_new_members = vetted_members.filter(
            application_date__month=date.month, application_date__year=date.year
        )

        entry.retain_count = active_new_members.count()
        entry.vetted_count = vetted_new_members.count()
        entry.save()

    return active_members.count()

def check_minecraft_server():
    if secrets.MINECRAFT:
        url = 'https://api.minetools.eu/ping/' + secrets.MINECRAFT

        try:
            r = requests.get(url, timeout=5)
            r.raise_for_status()
            players = [x['name'] for x in r.json()['players']['sample']]
            cache.set('minecraft_players', players)
            return players
        except BaseException as e:
            logger.error('Problem checking Minecraft: {} - {}'.format(e.__class__.__name__, str(e)))

    return []

def check_mumble_server():
    if secrets.MUMBLE:
        url = secrets.MUMBLE

        try:
            r = requests.get(url, timeout=5)
            r.raise_for_status()
            users = r.text.split()
            cache.set('mumble_users', users)
            return users
        except BaseException as e:
            logger.error('Problem checking Mumble: {} - {}'.format(e.__class__.__name__, str(e)))

    return []

def calc_card_scans():
    date = utils.today_alberta_tz()
    dt = datetime.combine(date, datetime.min.time())
    midnight = utils.TIMEZONE_CALGARY.localize(dt)

    cards = models.Card.objects
    count = cards.filter(last_seen__gte=midnight).count()

    cache.set('card_scans', count)

    models.StatsSpaceActivity.objects.update_or_create(
        date=date,
        defaults=dict(card_scans=count),
    )

def get_progress(request_id):
    return cache.get('request-progress-' + request_id, [])

def set_progress(request_id, data, replace=False):
    logger.info('Progress - ID: %s | Status: %s', request_id, data)
    progress = get_progress(request_id)

    if replace and len(progress):
        progress[-1] = data
    else:
        progress.append(data)

    cache.set('request-progress-' + request_id, progress)
