# Generates card photos for existing members with photos

import django, sys, os
os.environ['DJANGO_SETTINGS_MODULE'] = 'apiserver.settings'
django.setup()

from apiserver.api import models, utils

members = models.Member.objects
members = members.filter(photo_large__isnull=False)
members = members.filter(card_photo__isnull=True)

print('Count:', members.count())

for m in members:
    print('Processing', m.first_name, m.last_name)

    m.card_photo = utils.gen_card_photo(m)
    print(m.card_photo)

    m.save()

print('Done.')

