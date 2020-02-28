import django, sys, os
os.environ['DJANGO_SETTINGS_MODULE'] = 'apiserver.settings'
django.setup()

import datetime
import json
from apiserver.api import models, old_models, utils

members = models.Member.objects.all()

for m in members:
    first_name = m.first_name
    last_name = m.last_name
    preferred_name = m.preferred_name

    print('Updating:', first_name, last_name, '-->', first_name.title(), last_name.title())

    models.Member.objects.filter(id=m.id).update(
        first_name=first_name.title().strip(),
        last_name=last_name.title().strip(),
        preferred_name=preferred_name.title().strip(),
    )

print('Done.')
