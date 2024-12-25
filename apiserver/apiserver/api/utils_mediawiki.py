from mwclient import Site
from apiserver import secrets

site = Site(secrets.WIKI_ENDPOINT, path='/')
site.login(username=secrets.WIKI_USERNAME, password=secrets.WIKI_PASSWORD)

def get_next_tool_id():
    """Get the next available tool ID from the wiki"""
    # Tool IDs are managed on this page
    # https://wiki.protospace.ca/Protospace_Wiki:Wiki-ID_system#Next_available_wiki-ID_numbers
    page_name = 'Protospace_Wiki:Wiki-ID_system'
    # Section name: Next available wiki-ID numbers
    section = 1

    # grab page and section
    page = site.pages[page_name]
    text = page.text(section=section)

    # read through lines and look for the first page that doesn't exist
    for line in text.split("\n"):
        if line.startswith("* "):
            candidate_id = line.replace("* [[", "").replace("]]", "")
            if site.pages[candidate_id].text() == "":
                return candidate_id
    
    raise Exception("No next tool ID found. Please update the list: https://wiki.protospace.ca/Protospace_Wiki:Wiki-ID_system#Next_available_wiki-ID_numbers")

def create_tool_page(form_data):
    """Create a new tool page on the wiki
    Use the following schema:
        'loanstatus': 'owned',
        'functionalstatus': 'functional',
        'owner': 'Protospace',
        'toolname': str,
        'make': str,
        'model': str,
        'arrived': '2025-12-25',
        'location': str,
        'functional': 'Functional',
        'permission': str,
        'certification': str
    """
    tool_id = get_next_tool_id()

    photo_name = 'NoImage.png'
    if 'photo' in form_data:
        # upload photo
        photo_data = form_data['photo']
        # TODO: select the right MIME type?
        photo_name = f'{tool_id}.jpg'
        site.upload(photo_data, photo_name, 1, f"Photo of tool {tool_id}")

    # make a copy of form_data specifically avoiding the 'photo' field, which either:
    # 1 - doesnt exist
    # 2 - if it does exist, is an I/O object that is already closed because of the photo upload above and throws an exception on form_data.copy()
    form_copy = {}
    for k, v in form_data.items():
        if k is not 'photo':
            form_copy[k] = v
    # fill in empty fields
    for field in ['serial', 'caption', 'location']:
        if field not in form_data:
            form_copy[field] = ""

    body = f"""{{{{Equipment page
| toolname = {form_copy['toolname']}
| model = {form_copy['model']}
| serial = {form_copy['serial'] or ""}
| owner = {form_copy['owner']}
| loanstatus = {form_copy['loanstatus']}
| arrived = {form_copy['arrived']}
| location = {form_copy['location']}
| status = {form_copy['functionalstatus']}
| permission = {form_copy['permission'] or "All"}
| certification = {form_copy['certification'] or "None"}
| photo = {photo_name}
| caption = {form_copy['caption'] or ""}
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

"""

    name = f'{form_copy["toolname"]} ({form_copy["make"]} {form_copy["model"]} ID:{tool_id})'

    # create tool page
    page = site.pages[name]
    page.save(body, summary='Creating new tool page')

    # create redirect page
    redirect = site.pages[tool_id]
    redirect.save('#REDIRECT [[' + name + ']]{{id/after-redirect}}')

    return secrets.WIKI_ENDPOINT + f'/{tool_id}'
    # TODO: add to gallery

def delete_tool_page(tool_id):
    """Delete a tool page and its redirect page. Use when tool page has been created in error"""

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

    return tool_id
