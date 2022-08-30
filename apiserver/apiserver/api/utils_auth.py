import logging
logger = logging.getLogger(__name__)

import requests
from requests.exceptions import Timeout

from apiserver import secrets
from apiserver.api import utils

def wiki_is_configured():
    return bool(secrets.WIKI_AUTH_API_URL and secrets.AUTH_API_KEY)

def discourse_is_configured():
    return bool(secrets.DISCOURSE_AUTH_API_URL and secrets.AUTH_API_KEY)


def auth_api(url, data=None, json=None):
    try:
        headers = {'Authorization': 'Token ' + secrets.AUTH_API_KEY}
        r = requests.post(url, data=data, json=json, headers=headers, timeout=6)
        return r.status_code
    except Timeout as e:
        logger.info('Auth {} - {} - {}'.format(url, e.__class__.__name__, str(e)))
        logger.info('Auth timeout occured, assuming it worked and returning 200.')
        return 200
    except KeyboardInterrupt:
        raise
    except BaseException as e:
        logger.error('Auth {} - {} - {}'.format(url, e.__class__.__name__, str(e)))
        return None

def set_wiki_password(data):
    auth_data = dict(
        username=data['username'].lower(),
        password=data['password'],
    )
    return auth_api(secrets.WIKI_AUTH_API_URL + 'set-wiki-password', data=auth_data)

def set_discourse_password(data):
    auth_data = dict(
        username=data['username'].lower(),
        password=data['password'],
        first_name=data['first_name'],
        email=data['email'],
    )
    return auth_api(secrets.DISCOURSE_AUTH_API_URL + 'set-discourse-password', data=auth_data)

def add_discourse_group_members(group_name, usernames):
    json = dict(
        group_name=group_name,
        usernames=usernames,
    )
    return auth_api(secrets.DISCOURSE_AUTH_API_URL + 'add-discourse-group-members', json=json)

def remove_discourse_group_members(group_name, usernames):
    json = dict(
        group_name=group_name,
        usernames=usernames,
    )
    return auth_api(secrets.DISCOURSE_AUTH_API_URL + 'remove-discourse-group-members', json=json)

def change_discourse_username(username, new_username):
    data = dict(
        username=username,
        new_username=new_username,
    )
    return auth_api(secrets.DISCOURSE_AUTH_API_URL + 'change-discourse-username', data=data)
