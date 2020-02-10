import time
import datetime
from django.core.cache import cache
from django.utils.timezone import now
from apiserver.api import models

DEFAULTS = {
    'last_card_change': time.time(),
    'next_meeting': None,
    'next_clean': None,
    'member_count': None,
    'paused_count': None,
    'green_count': None,
    'bay_108_temp': None,
    'bay_110_temp': None,
}

def changed_card():
    '''
    Called whenever the card list could change, ie. cards added, modified, or
    user status becoming overdue by 3 months
    '''
    cache.set('last_card_change', time.time())

def calc_next_events():
    sessions = models.Session.objects

    member_meeting = sessions.filter(course=317, datetime__gte=now()).first()
    monthly_clean = sessions.filter(course=273, datetime__gte=now()).first()

    if member_meeting:
        cache.set('next_meeting', member_meeting.datetime)
    if monthly_clean:
        cache.set('next_clean', monthly_clean.datetime)

def calc_member_counts():
    members = models.Member.objects

    num_not_paused = members.filter(paused_date__isnull=True).count()
    num_paused = members.filter(paused_date__isnull=False).count()
    num_current = members.filter(status='Current').count()
    num_prepaid = members.filter(status='Prepaid').count()

    cache.set('member_count', num_not_paused)
    cache.set('paused_count', num_paused)
    cache.set('green_count', num_current + num_prepaid)
