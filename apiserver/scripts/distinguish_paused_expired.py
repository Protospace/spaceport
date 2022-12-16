# will not work after expired date change
# =======================================

import django, sys, os
os.environ['DJANGO_SETTINGS_MODULE'] = 'apiserver.settings'
django.setup()

from dateutil import relativedelta

from apiserver.api import models

members = models.Member.objects.all()
count = 0

for m in members:
    if m.paused_date and m.status == 'Former Member':
        print('Former member', m.preferred_name, m.last_name)

        if m.paused_date == m.expire_date:
            new_status = 'Expired Member'
            new_paused_date = m.paused_date + relativedelta.relativedelta(months=3)
            print('    Moving paused date', m.paused_date, '-->', new_paused_date)
            m.paused_date = new_paused_date
        else:
            new_status = 'Paused Member'

        print('    Setting status to', new_status)
        m.status = new_status
        count += 1
        m.save()

print('Processed', count)
