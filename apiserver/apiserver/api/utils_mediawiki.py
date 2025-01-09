import logging
logger = logging.getLogger(__name__)

from mwclient import Site
from apiserver import secrets

def is_configured():
    return bool(secrets.WIKI_ENDPOINT and secrets.WIKI_USERNAME and secrets.WIKI_PASSWORD)

def wiki_site_login():
    site = Site(secrets.WIKI_ENDPOINT, path='/')
    site.login(username=secrets.WIKI_USERNAME, password=secrets.WIKI_PASSWORD)
    return site

def get_next_tool_id(site):
    '''Get the next available tool ID from the wiki'''
    # Tool IDs are managed on this page
    # https://wiki.protospace.ca/Protospace_Wiki:Wiki-ID_system#Next_available_wiki-ID_numbers
    page_name = 'Protospace_Wiki:Wiki-ID_system'
    # Section name: Next available wiki-ID numbers
    section = 1

    # grab page and section
    page = site.pages[page_name]
    text = page.text(section=section)

    # read through lines and look for the first page that doesn't exist
    for line in text.split('\n'):
        if line.startswith('* '):
            candidate_id = line.replace('* [[', '').replace(']]', '')
            if site.pages[candidate_id].text() == '':
                logger.info('Found empty Wiki-ID: %s', candidate_id)
                return candidate_id
    
    raise Exception('No next tool ID found. Please update the list: https://wiki.protospace.ca/Protospace_Wiki:Wiki-ID_system#Next_available_wiki-ID_numbers')

def create_tool_page(form_data, user=None):
    '''Create a new tool page on the wiki
    Use the following schema:
        'loanstatus': 'owned',
        'functionalstatus': 'functional',
        'owner': 'Protospace',
        'toolname': str,
        'model': str,
        'arrived': '2025-12-25',
        'location': str,
        'functional': 'Functional',
        'permission': str,
        'certification': str
    '''

    if not is_configured():
        raise Exception('Mediawiki integration not configured, edit secrets.py')

    site = wiki_site_login()

    tool_id = get_next_tool_id(site)

    credit = ''
    if user:
        credit = ' on behalf of ' + user

    # collect calls for rolling back this operation incase it fails partway
    # each rollback item is a tuple: (rollback_function, dict of kwargs)
    # each rollback function will be called in the event of an Exception
    rollbacks = [ ]

    photo_name = 'NoImage.png'
    if 'photo' in form_data and form_data['photo']:
        # upload photo
        photo_data = form_data['photo']
        photo_extn = photo_data.content_type.replace('image/', '')
        photo_name = f'{tool_id}.{photo_extn}'
        site.upload(photo_data, photo_name, 1, f'Photo of tool {tool_id}', comment=f'Uploaded tool picture' + credit)
        rollback.append((site.pages[f'File:{photo_name}'].delete, {}))

    # make a copy of form_data specifically avoiding the 'photo' field
    # if photo is provided, is an I/O object that is already closed because of the above 
    # so ignore it to avoid the exception from form_data.copy()
    form_copy = {}
    for k, v in form_data.items():
        if k != 'photo':
            form_copy[k] = v
    # fill in empty fields
    for field in ['serial', 'caption', 'location']:
        if field not in form_data:
            form_copy[field] = ''

    # create tool page
    body = f'''{{{{Equipment page
| toolname = {form_copy['toolname']}
| model = {form_copy['model']}
| serial = {form_copy['serial'] or ''}
| owner = {form_copy['owner']}
| loanstatus = {form_copy['loanstatus']}
| arrived = {form_copy['arrived']}
| location = {form_copy['location']}
| status = {form_copy['functionalstatus']}
| permission = {form_copy['permission'] or 'All'}
| certification = {form_copy['certification'] or 'None'}
| photo = {photo_name}
| caption = {form_copy['caption'] or ''}
| id = {tool_id}
}}}}

==Specs==
TBD

==Usage==
TBD

==Troubleshooting==
TBD

==Documentation==
TBD

==Links==
{ form_copy['links'] if 'links' in form_copy else 'TBD' }
'''
    name = f'{form_copy["toolname"]} ({form_copy["model"]}) ID:{tool_id}'
    page = site.pages[name]
    summary = 'Creating new tool page'
    page.save(body, summary=summary + credit)
    rollback.append((page.delete, {'reason': 'Failed to complete tool creation'}))

    # create redirect page
    redirect = site.pages[tool_id]
    redirect.save('#REDIRECT [[' + name + ']]{{id/after-redirect}}', summary='Creating new tool redirect page' + credit)
    rollback.append((redirect.delete, {'reason': 'Failed to complete tool creation, initiating rollback'}))

    add_to_gallery(tool_id, photo_name, name)
    # TODO: rollback.append((remove_from_gallery, {'tool_id': tool_id}))

    tool_url = 'https://' + secrets.WIKI_ENDPOINT + f'/{tool_id}'

    logger.info('Created tool page: %s, url: %s', name, tool_url)

    return tool_url

def add_to_gallery(tool_id, photo_name, tool_name, PAGE_NAME='Tools_we_have', NEW_TOOL_SECTION=1):
    '''Add a tool to the gallery page'''

    if not is_configured():
        raise Exception('Mediawiki integration not configured, edit secrets.py')

    site = wiki_site_login()

    # find the section we should add the tool to
    # praying no one changes the page too much
    # avoiding card coding incase someone changes it and break this code
    # let's try to infer instead
    # Use the API to get the sections of the page
    response = site.api('parse', page=PAGE_NAME, prop='sections')

    # iterate through sections and find the one with the right title
    for section in response['parse']['sections']:
        # grab whatever section has misc in the title
        # hopefully that section sticks around
        if 'misc' in section['line'].lower():
            NEW_TOOL_SECTION = section['index']
            break

    # grab the gallery page and the text
    gallery_page = site.pages[PAGE_NAME]
    gallery_text = gallery_page.text(section=NEW_TOOL_SECTION)
    # print(gallery_text)

    # check if tool already exists in gallery
    if f'|link={tool_id}|' in gallery_page.text():
        raise Exception(f'Tool ID {tool_id} already has an entry in gallery')

    # remove 'File:' if it exists in photo_name
    # this is to avoid double 'File:File:' in the gallery
    if 'File:' in photo_name:
        photo_name = photo_name.replace('File:', '')

    # construct entry and insert into gallery
    new_line = f'File:{photo_name}|link={tool_id}|[[{tool_name}]]'
    new_text = gallery_text.replace('</gallery>', f'{new_line}\n</gallery>')
    # print(new_text)

    gallery_page.save(new_text, summary=f'Added tool {tool_id} to gallery', section=NEW_TOOL_SECTION)

    logger.info('Added tool ID: %s to gallery', tool_id)


def delete_tool_page(tool_id):
    '''Delete a tool page and its redirect page. Use when tool page has been created in error'''

    if not is_configured():
        raise Exception('Mediawiki integration not configured, edit secrets.py')

    site = wiki_site_login()

    redirect_page = site.pages[tool_id]
    if redirect_page.text() == '':
        # BUG: what about cases where redirect page doesnt exist, but tool_page and image do?
        raise FileNotFoundError(f'Tool ID {tool_id} does not exist')

    # delete the tool page
    tool_page = redirect_page.resolve_redirect()
    for image in tool_page.images():
        # if tool_id is in image title, there's a good chance its the tool picture
        # and we should get rid of it too
        if tool_id in image.page_title:
            image.delete('Requested deletion')
    tool_page.delete(reason='Requested deletion')

    # delete the redirect page
    redirect_page.delete(reason='Requested deletion')

    logger.info('Deleted tool page ID: %s', tool_id)

    return tool_id
