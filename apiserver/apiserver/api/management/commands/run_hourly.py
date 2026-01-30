from django.core.management.base import BaseCommand, CommandError
from django.utils.timezone import now
from apiserver.api import models, utils, utils_stats, utils_email
from datetime import datetime, timedelta

import time

class Command(BaseCommand):
    help = 'Tasks to run on the portal hourly.'

    def generate_stats(self):
        utils_stats.calc_next_events()
        counts = utils_stats.calc_member_counts()
        signup_count = utils_stats.calc_signup_counts()

        # do this hourly in case an admin causes a change
        models.StatsMemberCount.objects.update_or_create(
            date=utils.today_alberta_tz(),
            defaults=dict(
                member_count=counts['member_count'],
                green_count=counts['green_count'],
                six_month_plus_count=counts['six_month_plus_count'],
                vetted_count=counts['vetted_count'],
                subscriber_count=counts['subscriber_count'],
            ),
        )

        models.StatsSignupCount.objects.update_or_create(
            month=utils.today_alberta_tz().replace(day=1),
            defaults=dict(signup_count=signup_count),
        )

        utils_stats.calc_drink_sales()
        utils_stats.calc_card_scans()
        utils_stats.calc_dues_distribution()
        utils_stats.calc_year_distribution()
        utils_stats.calc_cert_distribution()
        utils_stats.calc_forum_activity()

        utils.gen_search_strings()

    def send_class_reminders(self):
        # sends reminders to instructors that they are teaching a class
        # within 6-7 hours from now
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

            if 'Event' in session.course.tags or 'Outing' in session.course.tags:
                self.stdout.write('    Is partially outing or event, skipping.')
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

    def send_attendance_reminders(self):
        # sends reminders to instructors to mark attendance for classes
        # that happened 6-7 hours ago if they haven't already
        count = 0

        now = utils.now_alberta_tz()
        current_hour_start = now.replace(minute=0, second=0, microsecond=0)

        six_hours_ago = current_hour_start - timedelta(hours=6)
        seven_hours_ago = current_hour_start - timedelta(hours=7)

        sessions = models.Session.objects.all()
        reminder_sessions = sessions.filter(
            datetime__gte=seven_hours_ago,
            datetime__lt=six_hours_ago,
        )

        if reminder_sessions.count() == 0:
            self.stdout.write('No classes found within timeframe, returning')
            return 0

        self.stdout.write('Found {} sessions between {} and {} mountain time.'.format(
            reminder_sessions.count(),
            str(seven_hours_ago),
            str(six_hours_ago),
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

            if 'Event' in session.course.tags or 'Outing' in session.course.tags:
                self.stdout.write('    Is partially outing or event, skipping.')
                continue

            if session.students.count() == 0:
                self.stdout.write('    Class is empty, skipping.')
                continue

            if session.students.filter(attendance_status='Attended').count() > 0:
                self.stdout.write('    Instructor already marked attendance, skipping.')
                continue

            self.stdout.write('    Emailing {} {}:'.format(session.instructor.username, session.instructor.email))

            utils.alert_tanner('Attendance reminder {} for {} {}'.format(
                str(session),
                session.instructor.username,
                session.instructor.email,
            ))

            self.stdout.write('    Sent attendance reminder email.')

            count += 1

        return count


    def handle(self, *args, **options):
        self.stdout.write('{} - Beginning hourly tasks'.format(str(now())))
        start = time.time()

        self.generate_stats()
        self.stdout.write('Generated stats')

        #count = self.send_class_reminders()
        #self.stdout.write('Sent {} class reminders'.format(count))

        count = self.send_attendance_reminders()
        self.stdout.write('Sent {} attendance reminders'.format(count))

        self.stdout.write('Completed tasks in {} s'.format(
            str(time.time() - start)[:4]
        ))
