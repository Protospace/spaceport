from django.core.management.base import BaseCommand, CommandError
from django.utils.timezone import now

from apiserver import settings
from apiserver.api import models, utils, utils_stats

import time
import os

if settings.DEBUG:
    STATIC_FOLDER = './data/static/'
else:
    STATIC_FOLDER = '/opt/spaceport/apiserver/data/static/'

class Command(BaseCommand):
    help = 'Delete unused static assets'

    def delete_old_static(self):
        members = models.Member.objects

        good_files = []
        for static_field in ['photo_large', 'photo_medium', 'photo_small', 'member_forms']:
            good_files.extend(members.values_list(static_field, flat=True))

        count = 0
        for f in os.listdir(STATIC_FOLDER):
            if len(f) != 40:
                self.stdout.write('Skipping: ' + f)
                continue

            if f[-3:] not in ['jpg', 'pdf', 'png']:
                self.stdout.write('Skipping: ' + f)
                continue

            if f not in good_files:
                os.remove(STATIC_FOLDER + f)
                count += 1

        return count

    def handle(self, *args, **options):
        self.stdout.write('{} - Deleting unused static files'.format(str(now())))
        start = time.time()

        count = self.delete_old_static()
        self.stdout.write('Deleted {} files'.format(count))

        self.stdout.write('Completed deletion in {} s'.format(
            str(time.time() - start)[:4]
        ))
