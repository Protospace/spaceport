import logging
logger = logging.getLogger(__name__)

import requests
import json

from apiserver import secrets
from apiserver.api import models

def api_openai_create_embeddings(text_list):
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
    courses = list(models.Course.objects.all())
    if not courses:
        logger.info("No courses to generate embeddings for.")
        return

    texts_to_embed = ['A course at a makerspace titled "{}"'.format(course.name) for course in courses]

    res = api_openai_create_embeddings(texts_to_embed)

    if res:
        for i, course in enumerate(courses):
            course.name_embedding = res['data'][i]['embedding']

        models.Course.objects.bulk_update(courses, ['name_embedding'])

        prompt_tokens = res['usage']['prompt_tokens']
        total_tokens = res['usage']['total_tokens']
        logger.info('Generated %d course embeddings. Prompt tokens: %d, Total tokens: %d', len(courses), prompt_tokens, total_tokens)
    else:
        logger.error("Failed to generate course embeddings from OpenAI API.")


def find_similar_courses(name):
    pass




