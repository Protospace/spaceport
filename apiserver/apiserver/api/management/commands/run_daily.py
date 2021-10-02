from django.core.management.base import BaseCommand, CommandError
from django.utils.timezone import now
from django.contrib.auth.models import User
from apiserver.api import models, utils, utils_stats, utils_auth

import time

class Command(BaseCommand):
    help = 'Tasks to run on the portal daily. 7am UTC = 12am or 1am Calgary'

    def tally_active_members(self):
        all_members = models.Member.objects
        active_members = all_members.filter(paused_date__isnull=True)

        for member in active_members:
            utils.tally_membership_months(member)

        return active_members.count()

    def update_discourse_groups(self):
        add_to_group = {
            'directors_current': [],
            'protospace_members': [],
            'protospace_members_former': [],
            'protospace_instructors': [],
        }
        remove_from_group = {
            'directors_current': [],
            'protospace_members': [],
            'protospace_members_former': [],
            'protospace_members_uber': [],
            'protospace_instructors': [],
        }

        for user in User.objects.filter(member__discourse_username__isnull=False):
            username = user.member.discourse_username

            # handle non-member vs. member
            if user.member.paused_date:
                add_to_group['protospace_members_former'].append(username)
                remove_from_group['directors_current'].append(username)
                remove_from_group['protospace_members'].append(username)
                remove_from_group['protospace_members_uber'].append(username)
                remove_from_group['protospace_instructors'].append(username)

                continue
            else:
                add_to_group['protospace_members'].append(username)
                remove_from_group['protospace_members_former'].append(username)

            # handle directors
            if user.member.is_director:
                add_to_group['directors_current'].append(username)
            else:
                remove_from_group['directors_current'].append(username)

            # handle instructors
            if user.member.is_instructor:
                add_to_group['protospace_instructors'].append(username)
            else:
                remove_from_group['protospace_instructors'].append(username)

        for group_name, usernames in add_to_group.items():
            utils_auth.add_discourse_group_members(group_name, usernames)

        for group_name, usernames in remove_from_group.items():
            utils_auth.remove_discourse_group_members(group_name, usernames)


    def handle(self, *args, **options):
        self.stdout.write('{} - Beginning daily tasks'.format(str(now())))
        start = time.time()

        count = self.tally_active_members()
        self.stdout.write('Tallied {} active members'.format(count))

        count = utils_stats.calc_retain_counts()
        self.stdout.write('Tallied {} retained members'.format(count))

        self.update_discourse_groups()
        self.stdout.write('Updated Discourse group memberships')

        utils_stats.changed_card()
        self.stdout.write('Updated card change time')

        self.stdout.write('Completed tasks in {} s'.format(
            str(time.time() - start)[:4]
        ))
