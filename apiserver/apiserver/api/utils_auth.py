import logging
logger = logging.getLogger(__name__)

import requests

from apiserver import secrets
from apiserver.api import utils

def wiki_is_configured():
    return bool(secrets.WIKI_AUTH_API_URL and secrets.AUTH_API_KEY)

def discourse_is_configured():
    return bool(secrets.DISCOURSE_AUTH_API_URL and secrets.AUTH_API_KEY)


def auth_api(url, data):
    try:
        headers = {'Authorization': 'Token ' + secrets.AUTH_API_KEY}
        r = requests.post(url, data=data, headers=headers, timeout=3)
        return r.status_code
    except BaseException as e:
        logger.error('Auth {} - {} - {}'.format(url, e.__class__.__name__, str(e)))
        return None

def set_wiki_password(data):
    auth_data = dict(
        username=data['username'],
        password=data['password'],
    )
    return auth_api(secrets.WIKI_AUTH_API_URL + 'set-wiki-password', auth_data)

def set_discourse_password(data):
    auth_data = dict(
        username=data['username'],
        password=data['password'],
        first_name=data['first_name'],
        email=data['email'],
    )
    return auth_api(secrets.DISCOURSE_AUTH_API_URL + 'set-discourse-password', auth_data)
