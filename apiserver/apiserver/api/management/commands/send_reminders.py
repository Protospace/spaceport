from django.core.management.base import BaseCommand, CommandError
from django.contrib.auth.models import User
from django.db.models import Max, F, Count, Q, Sum
from django.utils.timezone import now
from django.core.cache import cache
from django.db import transaction
from datetime import datetime, timedelta
import math

from apiserver import secrets, settings
from apiserver.api import models, utils, utils_email

import time

class Command(BaseCommand):
    help = 'Send email reminders to instructors that they are teaching a class'

    def send_class_reminders(self):
        count = 0

        now = utils.now_alberta_tz()
        current_hour_start = now.replace(minute=0, second=0, microsecond=0)

        in_six_hours = current_hour_start + timedelta(hours=6)
        in_seven_hours = current_hour_start + timedelta(hours=7)

        sessions = models.Session.objects.all()
        reminder_sessions = sessions.filter(
            datetime__gte=in_six_hours,
            datetime__lt=in_seven_hours,
        )

        if reminder_sessions.count() == 0:
            self.stdout.write('No classes found within timeframe, returning')
            return 0

        self.stdout.write('Found {} reminder sessions between {} and {} mountain time.'.format(
            reminder_sessions.count(),
            str(in_six_hours),
            str(in_seven_hours),
        ))

        for session in reminder_sessions:
            self.stdout.write('Session {} instructor {}:'.format(
                str(session),
                session.instructor.username,
            ))

            if session.is_cancelled:
                self.stdout.write('    Is cancelled, skipping.')
                continue

            if session.course.id in [317, 273, 413]:
                self.stdout.write('    Is members meeting or cleanup, skipping.')
                continue

            if session.course.tags in ['Event', 'Outing']:
                self.stdout.write('    Is only outing or event, skipping.')
                continue

            self.stdout.write('    Emailing {} {}:'.format(session.instructor.username, session.instructor.email))

            utils.alert_tanner('Class reminder {} for {} {}'.format(
                str(session),
                session.instructor.username,
                session.instructor.email,
            ))

            self.stdout.write('    Sent class reminder email.')

            count += 1

        return count

    def handle(self, *args, **options):
        self.stdout.write('{} - Class reminder emails'.format(str(now())))
        start = time.time()

        count = self.send_class_reminders()
        self.stdout.write('Sent {} reminders'.format(count))

        self.stdout.write('Completed reminders in {} s'.format(
            str(time.time() - start)[:4]
        ))
