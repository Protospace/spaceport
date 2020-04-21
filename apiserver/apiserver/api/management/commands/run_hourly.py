from django.core.management.base import BaseCommand, CommandError
from django.utils.timezone import now, pytz
from apiserver.api import models, utils, utils_stats

from datetime import datetime
import time

def today_alberta_tz():
    return datetime.now(pytz.timezone('America/Edmonton')).date()

class Command(BaseCommand):
    help = 'Tasks to run on the portal hourly.'

    def generate_stats(self):
        utils_stats.calc_next_events()
        member_count, green_count = utils_stats.calc_member_counts()

        # do this hourly in case an admin causes a change
        models.StatsMemberCount.objects.update_or_create(
            date=today_alberta_tz(),
            defaults=dict(member_count=member_count, green_count=green_count),
        )


    def handle(self, *args, **options):
        self.stdout.write('{} - Beginning hourly tasks'.format(str(now())))
        start = time.time()

        self.generate_stats()
        self.stdout.write('Generated stats')

        self.stdout.write('Completed tasks in {} s'.format(
            str(time.time() - start)[:4]
        ))
