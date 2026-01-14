import logging
logger = logging.getLogger(__name__)

import requests
import json

from apiserver import secrets

def api_openai_create_embeddings([text_list]):
    headers = {'Authorization': 'Bearer ' + secrets.OPENAI_API_KEY}
    data = {'input': text_list, 'model': 'text-embedding-3-small', 'encoding_format': 'base64'}
    url = 'https://api.openai.com/v1/embeddings'

    try:
        r = requests.post(url=url, headers=headers, json=data, timeout=5)
        r.raise_for_status()
        return r.json()
    except KeyboardInterrupt:
        raise
    except BaseException as e:
        logger.error('OpenAI API error {} - {} - {}'.format(url, e.__class__.__name__, str(e)))
        return None


def gen_course_name_embedding(name):
    text = 'A course at a makerspace titled "{}"'.format(name)

    res = api_openai_create_embeddings([text])

    if res:
        return res['data'][0]['embedding']
    else:
        return False

def gen_all_course_embeddings():
    pass
        
