import django, sys, os
os.environ['DJANGO_SETTINGS_MODULE'] = 'apiserver.settings'
django.setup()

import datetime
import json
import re
from apiserver.api import models, utils

def clean(name):
    return re.sub(r'[^a-z]', '', name.lower())

with open('ad-rabbit.json', 'r') as f:
    ad_dirty = json.load(f)

with open('ad-dump.json', 'r') as f:
    ad_dump = json.load(f)

ad = {}
for sam in ad_dirty:
    try:
        ad[clean(sam)] = ad_dump[sam]['mail']
    except KeyError:
        continue

members = models.Member.objects.all()

portal = {}
for m in members:
    name = m.first_name + m.last_name
    portal[clean(name)] = m

good_members = {}

for ad_name, email in ad.items():
    if ad_name in portal:
        good_members[ad_name] = portal[ad_name]
        print('found ad name match', ad_name)
    else:
        print('cant find ad name', ad_name)
        print('searching for email...')
        for m in members:
            if m.old_email and m.old_email.lower() == email.lower():
                good_members[ad_name] = m
                print('  found email', email)
                break
        else:
            print('  cant link email', email)

print()
print()

for m in good_members.values():
    if not m.rabbit_cert_date:
        m.rabbit_cert_date = utils.today_alberta_tz()
        print('certified', m.first_name, m.last_name)
        m.save()
    else:
        print('skipping', m.first_name, m.last_name)
