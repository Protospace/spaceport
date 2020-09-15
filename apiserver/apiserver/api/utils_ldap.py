import logging
logger = logging.getLogger(__name__)

import requests

from apiserver import secrets
from apiserver.api import utils

def is_configured():
    return bool(secrets.LDAP_API_URL and secrets.LDAP_API_KEY)


def ldap_api(route, data):
    try:
        headers = {'Authorization': 'Token ' + secrets.LDAP_API_KEY}
        url = secrets.LDAP_API_URL + route
        r = requests.post(url, data=data, headers=headers, timeout=3)
        return r.status_code
    except BaseException as e:
        logger.error('LDAP {} - {} - {}'.format(url, e.__class__.__name__, str(e)))
        return None

def find_user(username):
    ldap_data = dict(username=username)
    return ldap_api('find-user', ldap_data)

def create_user(data):
    ldap_data = dict(
        first=data['first_name'],
        last=data['last_name'],
        username=data['username'],
        email=data['email'],
        password=data['password1'],
    )
    return ldap_api('create-user', ldap_data)

def set_password(data):
    ldap_data = dict(
        username=data['username'],
        password=data['password1'],
    )
    return ldap_api('set-password', ldap_data)

def add_to_group(member, group):
    try:
        ldap_data = dict(group=group)

        if member.user:
            ldap_data['username'] = member.user.username
        else:
            ldap_data['email'] = member.old_email

        if ldap_api('add-to-group', ldap_data) != 200: raise
    except BaseException as e:
        logger.error('LDAP Group - {} - {}'.format(e.__class__.__name__, str(e)))
        m = '{} {} ({})'.format(member.first_name, member.last_name, member.id)
        msg = 'Problem adding {} to group {}!'.format(m, group)
        utils.alert_tanner(msg)
        logger.info(msg)

def remove_from_group(member, group):
    try:
        ldap_data = dict(group=group)

        if member.user:
            ldap_data['username'] = member.user.username
        else:
            ldap_data['email'] = member.old_email

        if ldap_api('remove-from-group', ldap_data) != 200: raise
    except BaseException as e:
        logger.error('LDAP Group - {} - {}'.format(e.__class__.__name__, str(e)))
        m = '{} {} ({})'.format(member.first_name, member.last_name, member.id)
        msg = 'Problem adding {} to group {}!'.format(m, group)
        utils.alert_tanner(msg)
        logger.info(msg)
