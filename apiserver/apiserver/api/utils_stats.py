from django.core.cache import cache
import time

DEFAULTS = {
    'last_card_change': time.time(),
    'next_meeting': None,
    'next_clean': None,
    'member_count': None,
    'due_members': None,
    'old_members': None,
    'bay_108_temp': None,
    'bay_110_temp': None,
}

def changed_card():
    '''
    Called whenever the card list could change, ie. cards added, modified, or
    user status becoming overdue by 3 months
    '''
    cache.set('last_card_change', time.time())
