from django.core.management.base import BaseCommand, CommandError
from django.contrib.auth.models import User
from apiserver.api import models, utils, utils_stats

import time

class Command(BaseCommand):
    help = 'Link old sessions to instructors. Usage example: link_old_sessions "Tanner C" tanner.collin'

    def add_arguments(self, parser):
        parser.add_argument('old_instructor', type=str)
        parser.add_argument('username', type=str)

    def link_old_sessions(self, old_instructor, username):
        sessions = models.Session.objects
        old_sessions = sessions.filter(old_instructor=old_instructor)

        if not old_sessions.exists():
            self.stdout.write('Old instructor not found. Aborting.')
            return 0

        user = User.objects.filter(username=username)

        if not user.exists():
            self.stdout.write('Username not found. Aborting.')
            return 0

        user = user.first()

        for s in old_sessions:
            s.instructor = user
            s.save()
            self.stdout.write('Linked ' + s.course.name)

        return old_sessions.count()

    def handle(self, *args, **options):
        old_instructor = options['old_instructor']
        username = options['username']

        self.stdout.write('Exact old instructor name: ' + old_instructor)
        self.stdout.write('Exact Spaceport username: ' + username)
        confirm = input('Is this correct? [y/N]: ')

        if confirm != 'y':
            self.stdout.write('Aborting.')
            return

        start = time.time()

        count = self.link_old_sessions(old_instructor, username)
        self.stdout.write('Linked {} old sessions'.format(str(count)))

        self.stdout.write('Completed in {} s'.format(
            str(time.time() - start)[:4]
        ))
