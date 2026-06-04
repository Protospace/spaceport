import logging
logger = logging.getLogger(__name__)

import requests
import random
import string
from requests.exceptions import Timeout

from apiserver import secrets
from apiserver.api import utils

def discourse_is_configured():
    return bool(secrets.DISCOURSE_AUTH_API_URL and secrets.AUTH_API_KEY)


def auth_api(url, data=None, json=None):
    try:
        headers = {'Authorization': 'Token ' + secrets.AUTH_API_KEY}
        r = requests.post(url, data=data, json=json, headers=headers, timeout=10)
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

def delete_discourse_test_user(username):
    data = dict(
        username=username,
    )
    return auth_api(secrets.DISCOURSE_AUTH_API_URL + 'delete-discourse-test-user', data=data)


def test_discourse_integration():
    if not discourse_is_configured():
        logger.info('Discourse not configured, skipping integration test.')
        return False

    rand = lambda: ''.join(random.choices(string.digits, k=10))

    data = {
        'username': 'test.auth' + rand(),
        'password': 'protospace' + rand(),
        'first_name': 'SpaceportTest',
        'email': 'test' + rand() + '@example.com',
    }

    logger.info('Creating test user: %s, email: %s', data['username'], data['email'])

    if set_discourse_password(data) != 200:
        utils.alert_tanner('Discourse integration test: problem creating user!')
        return False

    data['password'] = 'protospace' + rand()

    logger.info('Changing test user\'s password...')

    if set_discourse_password(data) != 200:
        utils.alert_tanner('Discourse integration test: problem changing password!')
        return False

    new_username = 'test.auth' + rand()
    logger.info('Changing test user\'s username to %s...', new_username)

    if change_discourse_username(data['username'], new_username) != 200:
        utils.alert_tanner('Discourse integration test: problem changing username!')
        return False

    logger.info('Adding test user to group...')

    if add_discourse_group_members('protospace_members', [new_username]) != 200:
        utils.alert_tanner('Discourse integration test: problem adding to group!')
        return False

    logger.info('Removing test user to group...')

    if remove_discourse_group_members('protospace_members', [new_username]) != 200:
        utils.alert_tanner('Discourse integration test: problem removing from group!')
        return False

    logger.info('Deleting test user...')

    if delete_discourse_test_user(new_username) != 200:
        utils.alert_tanner('Discourse integration test: problem deleting test user!')
        return False

    logger.info('Discourse integration test complete.')
    return True
