from django.core.management.base import BaseCommand, CommandError
from django.utils.timezone import now
from django.contrib.auth.models import User
from apiserver.api import models, utils, utils_stats, utils_auth

import time

class Command(BaseCommand):
    help = 'Tasks to run on the portal weekly. 7am UTC = 12am or 1am Calgary'

    def send_rate_reminder(self):
        # sends reminders to all active subsidized members whose
        # application week anniversary is this week
        count = 0

        all_members = models.Member.objects
        active_subsidized_members = all_members.filter(
            monthly_fees__gte=30,
            monthly_fees__lt=50,
            paused_date__isnull=True
        )

        today = utils.today_alberta_tz()
        _, this_week, _ = today.isocalendar()

        members_to_remind = active_subsidized_members.filter(application_date__week=this_week)

        self.stdout.write('Found {} members to remind in calendar week {}.'.format(
            members_to_remind.count(),
            this_week,
        ))

        for member in members_to_remind:
            self.stdout.write('    Emailing {} {}, dues: {}'.format(
                member.user.username,
                member.user.email,
                member.monthly_fees,
            ))

            utils.alert_tanner('Subsidized dues reminder {} {}, dues: {}'.format(
                member.user.username,
                member.user.email,
                member.monthly_fees,
            ))

            self.stdout.write('    Sent subsidized dues reminder email.')

            count += 1

        return count

    def handle(self, *args, **options):
        self.stdout.write('{} - Beginning weekly tasks'.format(str(now())))
        start = time.time()

        #count = self.send_rate_reminder()
        #self.stdout.write('Reminded {} subsidized members'.format(count))

        self.stdout.write('Completed tasks in {} s'.format(
            str(time.time() - start)[:4]
        ))
