from log import logger
import time
import secrets
import subprocess
import requests
from uuid import uuid4

from flask import abort

HTTP_NOTFOUND = 404

random_email = lambda: 'spaceport-' + str(uuid4()).split('-')[0] + '@protospace.ca'

def set_wiki_password(username, password):
    # sets a user's wiki password
    # creates the account if it doesn't exist

    if not secrets.WIKI_MAINTENANCE:
        logger.error('Wiki setting not configured, aborting')
        abort(400)

    if not username:
        logger.error('Empty username, aborting')
        abort(400)

    logger.info('Setting wiki password for: ' + username)

    if not password:
        logger.error('Empty password, aborting')
        abort(400)

    script = secrets.WIKI_MAINTENANCE + '/createAndPromote.php'

    result = subprocess.run(['php', script, '--force', username, password],
            shell=False, text=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)

    output = result.stdout or result.stderr
    output = output.strip()

    logger.info('Output: ' + output)

    if result.stderr:
        abort(400)

def discourse_api_get(url, params={}):
    headers = {
        'Api-Key': secrets.DISCOURSE_API_KEY,
        'Api-Username': secrets.DISCOURSE_API_USER,
    }
    response = requests.get(url, headers=headers, params=params, timeout=10)
    response.raise_for_status()
    logger.debug('Response: %s %s', response.status_code, response.text)
    return response

def discourse_api_put(url, data={}):
    headers = {
        'Api-Key': secrets.DISCOURSE_API_KEY,
        'Api-Username': secrets.DISCOURSE_API_USER,
    }
    response = requests.put(url, headers=headers, data=data, timeout=10)
    response.raise_for_status()
    logger.debug('Response: %s %s', response.status_code, response.text)
    return response

def discourse_api_post(url, data={}):
    headers = {
        'Api-Key': secrets.DISCOURSE_API_KEY,
        'Api-Username': secrets.DISCOURSE_API_USER,
    }
    response = requests.post(url, headers=headers, data=data, timeout=10)
    response.raise_for_status()
    logger.debug('Response: %s %s', response.status_code, response.text)
    return response

def discourse_api_delete(url, data={}):
    headers = {
        'Api-Key': secrets.DISCOURSE_API_KEY,
        'Api-Username': secrets.DISCOURSE_API_USER,
    }
    response = requests.delete(url, headers=headers, data=data, timeout=10)
    response.raise_for_status()
    logger.debug('Response: %s %s', response.status_code, response.text)
    return response

def discourse_rails_script(script):
    result = subprocess.run(['docker', 'exec', '-i', secrets.DISCOURSE_CONTAINER, 'rails', 'runner', script],
            shell=False, text=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    output = result.stdout or result.stderr
    output = output.strip() or 'No complaints'
    return result, output

def get_discourse_group_id(group_name):
    logger.info('Getting the ID of group %s', group_name)

    url = 'https://forum.protospace.ca/groups/{}.json'.format(group_name)
    response = discourse_api_get(url)
    response = response.json()
    return response['group']['id']

def get_discourse_usernames():
    usernames = []
    page = 1

    for _ in range(10):
        params = {
            'page': page,
        }
        response = discourse_api_get('https://forum.protospace.ca/admin/users/list/active.json', params)
        response = response.json()

        if not len(response):
            break

        for u in response:
            usernames.append(u['username'])

        page += 1
    else:  # for
        logger.error('Too many user pages, aborting')
        abort(400)

    return usernames

def translate_usernames(portal_usernames, discourse_usernames):
    # the case of portal and discourse usernames might not match
    # this causes a problem if someone creates a discourse user
    # as John.Smith and later sets up a portal account as john.smith
    #
    # solution: look for usernames in discourse with the same letters,
    # and then convert to the discourse version when using the API

    result = []

    for pu in portal_usernames:
        for du in discourse_usernames:
            if pu.lower() == du.lower():
                result.append(du)
                break
        else:  # for
            result.append(pu)

    return result

def set_discourse_password(username, password, first_name, email):
    # sets a user's discourse password
    # creates the account if it doesn't exist
    # things to test:
    #   - user changes Spaceport password
    #   - user changes Spaceport password to same
    #   - new Spaceport signup
    #   - existing Discourse user Spaceport signup
    #   - existing Discourse user Spaceport signup with same email
    # note: Spaceport emails are unconfirmed!!

    if not secrets.DISCOURSE_CONTAINER or not secrets.DISCOURSE_API_KEY or not secrets.DISCOURSE_API_USER:
        logger.error('Discourse setting not configured, aborting')
        abort(400)

    if not username:
        logger.error('Empty username, aborting')
        abort(400)

    if not password:
        logger.error('Empty password, aborting')
        abort(400)

    if not first_name:
        logger.error('Empty first_name, aborting')
        abort(400)

    if not email:
        logger.error('Empty email, aborting')
        abort(400)

    discourse_usernames = get_discourse_usernames()
    username = translate_usernames([username], discourse_usernames)[0]

    logger.info('Checking Discourse for existing email: ' + email)
    params = {
        'filter': email,
        'show_emails': 'true',
    }
    response = discourse_api_get('https://forum.protospace.ca/admin/users/list/active.json', params)
    response = response.json()

    for user in response:
        if user['email'].lower() == email.lower():
            if user['username'] == username:
                logger.info('Username match, skipping')
                continue

            new_email = random_email()
            logger.info('Email found on different user %s, changing to: %s', user['username'], new_email)

            script = 'UserEmail.find_by(email: "{}").update!(email: "{}")'.format(email, new_email)
            result, output = discourse_rails_script(script)

            logger.info('Confirming email change...')
            response = discourse_api_get('https://forum.protospace.ca/admin/users/list/active.json', params)
            if len(response.json()):
                logger.error('Email change failed, aborting')
                abort(400)


    logger.info('Creating Discourse user for: ' + username)

    data = {
        'name': first_name,
        'username': username,
        'password': password,
        'email': email,
        'active': True,
        'approved': True,
    }
    response = discourse_api_post('https://forum.protospace.ca/users.json', data)
    response = response.json()

    if response['success']:
        logger.info('Skipping set password')
        return True

    logger.info('User exists, setting Discourse password for: ' + username)

    script = 'User.find_by(username: "{}").update!(password: "{}")'.format(username, password)
    result, output = discourse_rails_script(script)

    if 'Password is the same' in result.stderr:
        logger.info('Output: Password is the same as your current password. (ActiveRecord::RecordInvalid)')
        return True
    else:
        logger.info('Output: ' + output)

    if result.stderr:
        abort(400)


def add_discourse_group_members(group_name, usernames):
    if not group_name:
        logger.error('Empty group_name, aborting')
        abort(400)

    if not usernames:
        logger.error('Empty usernames, aborting')
        abort(400)

    discourse_usernames = get_discourse_usernames()
    usernames = translate_usernames(usernames, discourse_usernames)
    usernames = set(usernames)
    group_id = get_discourse_group_id(group_name)

    logger.info('Filtering out usernames not on Discourse...')

    discourse_usernames = set(discourse_usernames)
    usernames = usernames & discourse_usernames

    logger.info('Filtering out usernames that are already group members...')

    url = 'https://forum.protospace.ca/groups/{}/members.json'.format(group_name)
    response = discourse_api_get(url)
    response = response.json()

    member_usernames = set([m['username'] for m in response['members']])
    usernames = usernames - member_usernames
    usernames = list(usernames)

    if not len(usernames):
        logger.info('Skipping, no one left to add')
        return True

    logger.info('Adding %s remaining usernames to the group...', len(usernames))

    url = 'https://forum.protospace.ca/groups/{}/members.json'.format(group_id)
    data = {
        'usernames': ','.join(usernames)
    }
    discourse_api_put(url, data)
    return True

def remove_discourse_group_members(group_name, usernames):
    if not group_name:
        logger.error('Empty group_name, aborting')
        abort(400)

    if not usernames:
        logger.error('Empty usernames, aborting')
        abort(400)

    discourse_usernames = get_discourse_usernames()
    usernames = translate_usernames(usernames, discourse_usernames)
    usernames = set(usernames)
    group_id = get_discourse_group_id(group_name)

    logger.info('Filtering out usernames not on Discourse...')

    discourse_usernames = set(discourse_usernames)
    usernames = usernames & discourse_usernames
    usernames = list(usernames)

    if not len(usernames):
        logger.info('Skipping, no one left to remove')
        return True

    logger.info('Removing %s remaining usernames from the group...', len(usernames))

    url = 'https://forum.protospace.ca/groups/{}/members.json'.format(group_id)
    data = {
        'usernames': ','.join(usernames)
    }
    discourse_api_delete(url, data)
    return True



if __name__ == '__main__':
    #set_wiki_password('tanner.collin', 'protospace1')
    #set_discourse_password('test8a', 'protospace1', 'testie', 'test8@example.com')
    print(get_discourse_usernames())
    pass
