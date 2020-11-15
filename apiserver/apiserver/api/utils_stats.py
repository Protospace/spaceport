import logging
logger = logging.getLogger(__name__)

import time
from datetime import date, datetime
import requests
from django.core.cache import cache
from django.utils.timezone import now, pytz
from apiserver.api import models
from apiserver import secrets

def today_alberta_tz():
    return datetime.now(pytz.timezone('America/Edmonton')).date()

DEFAULTS = {
    'last_card_change': time.time(),
    'next_meeting': None,
    'next_clean': None,
    'member_count': None,
    'paused_count': None,
    'green_count': None,
    'bay_108_temp': None,
    'bay_110_temp': None,
    'minecraft_players': [],
    'mumble_users': [],
    'card_scans': 0,
    'track': {},
}

def changed_card():
    '''
    Called whenever the card list could change, ie. cards added, modified, or
    user status becoming overdue by 3 months
    '''
    cache.set('last_card_change', time.time())

def calc_next_events():
    sessions = models.Session.objects

    member_meeting = sessions.filter(is_cancelled=False, course=317, datetime__gte=now()).first()
    monthly_clean = sessions.filter(is_cancelled=False, course=273, datetime__gte=now()).first()

    if member_meeting:
        cache.set('next_meeting', member_meeting.datetime)
    else:
        cache.set('next_meeting', None)

    if monthly_clean:
        cache.set('next_clean', monthly_clean.datetime)
    else:
        cache.set('next_clean', None)

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

    cache.set('member_count', member_count)
    cache.set('paused_count', paused_count)
    cache.set('green_count', green_count)

    return member_count, green_count

def calc_signup_counts():
    month_beginning = today_alberta_tz().replace(day=1)

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
    date = today_alberta_tz()
    cards = models.Card.objects
    count = cards.filter(last_seen_at=date).count()

    cache.set('card_scans', count)

    models.StatsSpaceActivity.objects.update_or_create(
        date=today_alberta_tz(),
        defaults=dict(card_scans=count),
    )
