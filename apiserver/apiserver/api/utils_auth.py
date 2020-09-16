import logging
logger = logging.getLogger(__name__)

import requests

from apiserver import secrets
from apiserver.api import utils

def is_configured():
    return bool(secrets.AUTH_API_URL and secrets.AUTH_API_KEY)


def auth_api(route, data):
    try:
        headers = {'Authorization': 'Token ' + secrets.AUTH_API_KEY}
        url = secrets.AUTH_API_URL + route
        r = requests.post(url, data=data, headers=headers, timeout=3)
        return r.status_code
    except BaseException as e:
        logger.error('Auth {} - {} - {}'.format(url, e.__class__.__name__, str(e)))
        return None

def set_password(data):
    auth_data = dict(
        username=data['username'],
        password=data['password1'],
    )
    return auth_api('set-password', auth_data)
