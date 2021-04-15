from django.core.management.base import BaseCommand, CommandError
from django.utils.timezone import now
from django.core.cache import cache
from django.db import transaction

from apiserver import secrets, settings
from apiserver.api import models

from uuid import uuid4
import subprocess
import time

if settings.DEBUG:
    API_FOLDER = '.'
    DATA_FOLDER = './data'
    BACKUP_FOLDER = './backups'
else:
    API_FOLDER = '/opt/spaceport/apiserver'
    DATA_FOLDER = '/opt/spaceport/apiserver/data'
    BACKUP_FOLDER = '/opt/spaceport/apiserver/backups'

backup_id_string = lambda x: '{}\t{}\t{}'.format(
    str(now()), x['name'], x['backup_id'],
)

class Command(BaseCommand):
    help = 'Generate backups.'

    @transaction.atomic
    def generate_backups(self):
        backup_users = secrets.BACKUP_TOKENS.values()
        count = 0

        for user in backup_users:
            models.MetaInfo.objects.update_or_create(
                id=0,
                defaults=dict(backup_id=backup_id_string(user)),
            )
            with open(DATA_FOLDER + '/backup_user.txt', 'w') as f:
                f.write(user['name'] + '\n')
            with open(DATA_FOLDER + '/static/123e4567-e89b-12d3-a456-426655440000.jpg', 'w') as f:
                f.write(backup_id_string(user) + '\n')

            if user['name'] == 'null':  # reset the canaries for data-at-rest
                continue

            file_name = 'spaceport-backup-{}.tar.gz'.format(
                str(now().date()),
            )

            path_name = str(uuid4())

            full_name = '{}/{}/{}'.format(
                BACKUP_FOLDER,
                path_name,
                file_name,
            )

            mkdir_command = [
                'mkdir',
                BACKUP_FOLDER + '/' + path_name,
            ]

            tar_command = [
                'tar',
                '-czf',
                full_name,
                '--directory',
                API_FOLDER,
                'data/',
            ]

            subprocess.run(mkdir_command, check=True)
            subprocess.run(tar_command, check=True)

            cache.set(user['cache_key'], path_name + '/' + file_name)

            self.stdout.write('Wrote backup for: ' + user['name'])
            count += 1

        return count

    def handle(self, *args, **options):
        self.stdout.write('{} - Generating backups'.format(str(now())))
        start = time.time()

        count = self.generate_backups()
        self.stdout.write('Generated {} backups'.format(count))

        self.stdout.write('Completed backups in {} s'.format(
            str(time.time() - start)[:4]
        ))
