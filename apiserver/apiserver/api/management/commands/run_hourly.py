from django.core.management.base import BaseCommand, CommandError
from apiserver.api import models, utils, utils_stats

import time

class Command(BaseCommand):
    help = 'Tasks to run on the portal hourly.'

    def generate_stats(self):
        utils_stats.calc_next_events()
        utils_stats.calc_member_counts()


    def handle(self, *args, **options):
        start = time.time()

        count = self.generate_stats()
        self.stdout.write('Generated stats')

        self.stdout.write('Completed tasks in {} s'.format(
            str(time.time() - start)
        ))
