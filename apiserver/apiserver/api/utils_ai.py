import logging
logger = logging.getLogger(__name__)

import requests
import json
import base64
import struct
import math
import itertools
import statistics

from apiserver import secrets
from apiserver.api import models

#format_course_name = lambda name: 'A course at a makerspace titled "{}"'.format(name)  # 0.003131
#format_course_name = lambda name: 'A course titled "{}"'.format(name)  # 0.005670
#format_course_name = lambda name: '"{}"'.format(name)  # 0.009028
format_course_name = lambda name: 'A course titled "{}" at a non-profit club, taught by volunteers. It\'s a makerspace which is a two-bay shop filled with all kinds of different tools.'.format(name)  # 0.002736

def cosine_similarity(v1, v2):
    dot_product = sum(x*y for x, y in zip(v1, v2))
    magnitude1 = math.sqrt(sum(x*x for x in v1))
    magnitude2 = math.sqrt(sum(x*x for x in v2))
    if not magnitude1 or not magnitude2:
        return 0.0
    return dot_product / (magnitude1 * magnitude2)

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
    text = format_course_name(name)

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

    texts_to_embed = [format_course_name(course.name) for course in courses]

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
    query_embedding_b64 = gen_course_name_embedding(name)
    if not query_embedding_b64:
        logger.error("Could not generate embedding for query name: %s", name)
        return []

    try:
        decoded_query = base64.b64decode(query_embedding_b64)
        query_vector = struct.unpack('<1536f', decoded_query)
    except (struct.error, TypeError, base64.binascii.Error) as e:
        logger.error("Failed to decode or unpack query embedding for '%s': %s", name, e)
        return []

    courses_with_embeddings = models.Course.objects.exclude(name_embedding__exact='')
    if not courses_with_embeddings:
        logger.info("No courses with embeddings found to compare against.")
        return []

    similarities = []
    for course in courses_with_embeddings:
        try:
            decoded_course = base64.b64decode(course.name_embedding)
            course_vector = struct.unpack('<1536f', decoded_course)
            similarity = cosine_similarity(query_vector, course_vector)
            similarities.append((course.name, similarity))
        except (struct.error, TypeError, base64.binascii.Error) as e:
            logger.warning("Could not process course '%s' (id: %d): %s", course.name, course.id, e)
            continue

    similarities.sort(key=lambda x: x[1], reverse=True)

    return similarities[:10]


def calc_variance_of_similarity_scores():
    courses_with_embeddings = models.Course.objects.exclude(name_embedding__exact='')
    if not courses_with_embeddings:
        logger.info("No courses with embeddings found to calculate variance.")
        return 0.0

    vectors = []
    for course in courses_with_embeddings:
        try:
            decoded_course = base64.b64decode(course.name_embedding)
            vectors.append(struct.unpack('<1536f', decoded_course))
        except (struct.error, TypeError, base64.binascii.Error) as e:
            logger.warning("Could not process course '%s' (id: %d): %s", course.name, course.id, e)
            continue
    
    # Variance requires at least two similarity scores, which requires at least 3 vectors.
    if len(vectors) < 3:
        logger.info("Not enough vectors to calculate variance (need at least 3).")
        return 0.0

    similarity_scores = [cosine_similarity(v1, v2) for v1, v2 in itertools.combinations(vectors, 2)]

    variance = statistics.variance(similarity_scores)
    logger.info('Calculated variance of similarity scores: %f from %d pairs', variance, len(similarity_scores))
    return variance


def calc_cluster_separation_score():
    courses_with_data = models.Course.objects.exclude(name_embedding__exact='').exclude(tags__exact='')
    if not courses_with_data:
        logger.info("No courses with embeddings and tags found to calculate cluster separation.")
        return 0.0

    processed_courses = []
    for course in courses_with_data:
        try:
            decoded_course = base64.b64decode(course.name_embedding)
            vector = struct.unpack('<1536f', decoded_course)
            tags = set(course.tags.split(','))
            processed_courses.append({'vector': vector, 'tags': tags, 'name': course.name, 'id': course.id})
        except (struct.error, TypeError, base64.binascii.Error) as e:
            logger.warning("Could not process course '%s' (id: %d): %s", course.name, course.id, e)
            continue

    if len(processed_courses) < 2:
        logger.info("Not enough processed courses to compare for cluster separation.")
        return 0.0

    intra_cluster_scores = []
    inter_cluster_scores = []

    for course_a, course_b in itertools.combinations(processed_courses, 2):
        similarity = cosine_similarity(course_a['vector'], course_b['vector'])

        if not course_a['tags'].isdisjoint(course_b['tags']):
            intra_cluster_scores.append(similarity)
        else:
            inter_cluster_scores.append(similarity)

    if not intra_cluster_scores:
        avg_intra_similarity = 0.0
        logger.warning("No pairs with shared tags found. Cannot calculate intra-cluster similarity.")
    else:
        avg_intra_similarity = statistics.mean(intra_cluster_scores)

    if not inter_cluster_scores:
        avg_inter_similarity = 0.0
        logger.warning("No pairs with different tags found. Cannot calculate inter-cluster similarity.")
    else:
        avg_inter_similarity = statistics.mean(inter_cluster_scores)

    logger.info(
        'Intra-cluster: avg similarity %f from %d pairs. Inter-cluster: avg similarity %f from %d pairs.',
        avg_intra_similarity, len(intra_cluster_scores),
        avg_inter_similarity, len(inter_cluster_scores)
    )

    if avg_inter_similarity == 0:
        logger.warning("Average inter-cluster similarity is zero, cannot compute ratio.")
        return 0.0

    score = avg_intra_similarity / avg_inter_similarity
    logger.info('Calculated cluster separation score: %f', score)
    return score




