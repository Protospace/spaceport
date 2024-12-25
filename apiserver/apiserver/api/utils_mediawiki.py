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

    photo = "NoImage.png"
    if 'photo' in form_data:
        # TODO upload photo
        photo = "name of uploaded file.jpg"

    form_copy = form_data.copy()
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
| photo = {photo}
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

    name = f"{form_copy['toolname']} ({form_copy['make']} {form_copy['model']} ID:{tool_id})"

    # create tool page
    page = site.pages[name]
    page.save(body, summary="Creating new tool page")

    # create redirect page
    redirect = site.pages[tool_id]
    redirect.save("#REDIRECT [[" + name + "]]{{id/after-redirect}}")

    return secrets.WIKI_ENDPOINT + f"/{tool_id}"
    # TODO: add to gallery

def delete_tool_page(tool_id):
    """Delete a tool page and its redirect page. Use when tool page has been created in error"""
    page = site.pages[tool_id]

    # TODO except if page doesnt exist

    # delete the tool page
    for link in page.links():
        if f"ID:{tool_id}" in link.page_title:
            link.delete(reason="Requested deletion")

    # delete the redirect page
    page.delete(reason="Requested deletion")

    return tool_id
