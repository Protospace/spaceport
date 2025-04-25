import logging
logger = logging.getLogger(__name__)

import requests
import json

#breakpoint()

if __name__ == '__main__':
    import os, logging
    DEBUG = os.environ.get('DEBUG')
    logging.basicConfig(
            format='[%(asctime)s] %(levelname)s %(module)s/%(funcName)s - %(message)s',
            level=logging.DEBUG if DEBUG else logging.INFO)
    logger = logging
    import sys
    sys.path.append('../..')

from apiserver import secrets


def is_configured():
    return bool(secrets.TODO_API_URL and secrets.TODO_API_KEY)


def api_put_task(project_id, position, title):
    headers = {'Authorization': 'Bearer ' + secrets.TODO_API_KEY}
    data = {'title': title, 'position': position}
    url = secrets.TODO_API_URL + 'projects/{}/tasks'.format(project_id)

    try:
        r = requests.put(url=url, headers=headers, json=data, timeout=5)
        r.raise_for_status()
        return r.json()
    except KeyboardInterrupt:
        raise
    except BaseException as e:
        logger.error('Todo API error {} - {} - {}'.format(url, e.__class__.__name__, str(e)))
        return None


def api_find_projects(project_name):
    headers = {'Authorization': 'Bearer ' + secrets.TODO_API_KEY}
    url = secrets.TODO_API_URL + 'projects'
    params = {'s': project_name}

    try:
        r = requests.get(url=url, headers=headers, timeout=5)
        r.raise_for_status()
        return r.json()
    except KeyboardInterrupt:
        raise
    except BaseException as e:
        logger.error('Todo API error {} - {} - {}'.format(url, e.__class__.__name__, str(e)))
        return None


def api_get_project(project_id):
    headers = {'Authorization': 'Bearer ' + secrets.TODO_API_KEY}
    url = secrets.TODO_API_URL + 'projects/{}'.format(project_id)

    try:
        r = requests.get(url=url, headers=headers, timeout=5)
        r.raise_for_status()
        return r.json()
    except KeyboardInterrupt:
        raise
    except BaseException as e:
        logger.error('Todo API error {} - {} - {}'.format(url, e.__class__.__name__, str(e)))
        return None


def api_get_tasks(project_id, view_id, search='', filter=''):
    headers = {'Authorization': 'Bearer ' + secrets.TODO_API_KEY}
    params = {'s': search, 'filter': filter}
    url = secrets.TODO_API_URL + 'projects/{}/views/{}/tasks'.format(project_id, view_id)

    try:
        r = requests.get(url=url, headers=headers, params=params, timeout=5)
        r.raise_for_status()
        return r.json()
    except KeyboardInterrupt:
        raise
    except BaseException as e:
        logger.error('Todo API error {} - {} - {}'.format(url, e.__class__.__name__, str(e)))
        return None


def api_post_position(task_id, view_id, position):
    headers = {'Authorization': 'Bearer ' + secrets.TODO_API_KEY}
    data = {'task_id': task_id, 'project_view_id': view_id, 'position': position}
    url = secrets.TODO_API_URL + 'tasks/{}/position'.format(task_id)

    try:
        r = requests.post(url=url, headers=headers, json=data, timeout=5)
        r.raise_for_status()
        return r.json()
    except KeyboardInterrupt:
        raise
    except BaseException as e:
        logger.error('Todo API error {} - {} - {}'.format(url, e.__class__.__name__, str(e)))
        return None


def add_task_or_bump(project_name, title):
    # adds a task to the beginning of a project
    # if the task is already exists and is not finished, bumps it to the top
    # if it's already at the top, does nothing

    logging.info('Adding task: %s, project: %s.', title, project_name)

    if not is_configured():
        raise Exception('Vikunja integration not configured.')

    projects = api_find_projects(project_name)

    for project in projects:
        if project['title'] == project_name:
            project_id = project['id']
            view_id = project['views'][0]['id']
            break
    else:  # for
        raise Exception('Project not found.')

    all_tasks = api_get_tasks(project_id, view_id)

    if len(all_tasks) == 0:
        logger.info('Task list empty, adding.')
        api_put_task(project_id, 1024, title)
        return True

    top_task = all_tasks[0]
    same_tasks = api_get_tasks(project_id, view_id, search=title, filter='done = false')

    if top_task['title'] == title and top_task['done'] == False:
        logger.info('Task already at the top, returning.')
        return

    top_position = top_task['position'] / 2.0

    for task in same_tasks:
        if task['title'] == title:
            api_post_position(task['id'], view_id, top_position)
            logger.info('Existing task found, bumping.')
            return True

    logger.info('Existing task not found, adding.')

    api_put_task(project_id, top_position, title)
    return True


def get_task_list(project_name):
    # gets a list of tasks for a given project

    logging.debug('Getting tasks for project: %s.', project_name)

    if not is_configured():
        raise Exception('Vikunja integration not configured.')

    projects = api_find_projects(project_name)

    for project in projects:
        if project['title'] == project_name:
            project_id = project['id']
            view_id = project['views'][0]['id']
            break
    else:  # for
        raise Exception('Project not found.')

    all_tasks = api_get_tasks(project_id, view_id)

    return all_tasks



if __name__ == '__main__':
    logger.info('Test putting task...')

    add_task_or_bump('Consumables', 'test task from API')
