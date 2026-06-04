from django.core.management.base import BaseCommand, CommandError
from django.utils.timezone import now
from apiserver.api import utils_auth

import time

class Command(BaseCommand):
    help = 'Tests the discourse integration'

    def handle(self, *args, **options):
        self.stdout.write('{} - Beginning Discourse integration test'.format(str(now())))
        start = time.time()

        utils_auth.test_discourse_integration()

        self.stdout.write('Completed tasks in {} s'.format(
            str(time.time() - start)[:4]
        ))
