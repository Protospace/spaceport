import logging
logger = logging.getLogger(__name__)

import time
import datetime
import requests
from django.core.cache import cache
from django.utils.timezone import now
from apiserver.api import models
from apiserver import secrets

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

    num_active = num_current + num_prepaid + num_due + num_overdue
    num_former = members.count() - num_active

    cache.set('member_count', num_active)
    cache.set('paused_count', num_former)
    cache.set('green_count', num_current + num_prepaid)

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
            cache.set('minecraft_players', [])
            logger.error('Problem checking Minecraft: {} - {}'.format(e.__class__.__name__, str(e)))

    return []
