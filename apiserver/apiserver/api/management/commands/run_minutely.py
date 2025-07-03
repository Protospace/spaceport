from django.core.management.base import BaseCommand, CommandError
from django.utils.timezone import now
from apiserver.api import models, utils, utils_stats

import time

class Command(BaseCommand):
    help = 'Tasks to run on the portal minutely.'


    def handle(self, *args, **options):
        self.stdout.write('{} - Beginning minutely tasks'.format(str(now())))
        start = time.time()

        players = utils_stats.check_minecraft_server()
        self.stdout.write('Found Minecraft players: ' + str(players))
        users = utils_stats.check_mumble_server()
        self.stdout.write('Found Mumble users: ' + str(users))
        tasks = utils_stats.check_shopping_list()
        self.stdout.write('Found shopping tasks: ' + str([x['title'] for x in tasks]))

        self.stdout.write('Completed tasks in {} s'.format(
            str(time.time() - start)[:4]
        ))
