import django, sys, os
sys.path.append("..")
os.environ['DJANGO_SETTINGS_MODULE'] = 'apiserver.settings'
django.setup()

import random
import string
import datetime
from uuid import uuid4
import requests
from apiserver.api import models

API_URL = 'http://localhost:8002'

if len(sys.argv) == 2:
    token = sys.argv[1]
else:
    raise('Please provide a login token in the command line')

members = models.Member.objects.all()
member_ids = list(members.values_list('id', flat=True))
courses = models.Course.objects.all()
course_ids = list(courses.values_list('id', flat=True))


randstr = lambda: str(uuid4()).split('-')[-1]

build_user = lambda: dict(
    first_name='test',
    last_name='tester',
    username=randstr()+'.tester',
    password1='protospace',
    password2='protospace',
    email=randstr()+'@domain.com',
    existing_member='false',
)

change_member = lambda: dict(
    street_address=randstr(),
    city=randstr(),
    postal_code=randstr(),
    first_name=randstr(),
)

build_transaction = lambda member_id: dict(
    member_id=member_id,
    date='2020-02-02',
    amount=0,
    account_type='Clearing',
    info_source='DB Edit',
    memo='Test transaction, ignore'
)

build_card = lambda member_id: dict(
    member_id=member_id,
    card_number=randstr(),
    active_status='card_active',
    notes='qot',
)

build_search = lambda: dict(
    q=random.choice(string.ascii_lowercase),
    seq=123,
)

build_session = lambda: dict(
    datetime=datetime.datetime.now(),
    course=random.choice(course_ids),
    cost=0,
)

def poster(headers, payload, route):
    r = requests.post(API_URL + route, data=payload, headers=headers, timeout=5)
    if r.status_code < 300:
        print(r.text.strip())
    else:
        print(r.text)
        raise Exception('Bad response code ' + str(r.status_code))

def patcher(headers, payload, route):
    r = requests.patch(API_URL + route, data=payload, headers=headers, timeout=5)
    if r.status_code < 300:
        print(r.text.strip())
    else:
        print(r.text)
        raise Exception('Bad response code ' + str(r.status_code))


def register_member():
    payload = build_user()
    poster({}, payload, '/registration/')

def edit_member():
    payload = change_member()
    headers = {'Authorization': 'Token ' + token}
    patcher(headers, payload, '/members/'+str(random.choice(member_ids))+'/')

def create_transaction():
    headers = {'Authorization': 'Token ' + token}
    payload = build_transaction(random.choice(member_ids))
    poster(headers, payload, '/transactions/')

def create_card():
    headers = {'Authorization': 'Token ' + token}
    payload = build_card(random.choice(member_ids))
    poster(headers, payload, '/cards/')

def perform_search():
    headers = {'Authorization': 'Token ' + token}
    payload = build_search()
    poster(headers, payload, '/search/')

def create_session():
    headers = {'Authorization': 'Token ' + token}
    payload = build_session()
    poster(headers, payload, '/sessions/')



while True:
    register_member()
    edit_member()
    perform_search()
    create_transaction()
    create_card()
    create_session()
