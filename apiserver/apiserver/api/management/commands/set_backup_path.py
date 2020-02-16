from django.core.management.base import BaseCommand, CommandError
from django.core.cache import cache

class Command(BaseCommand):
    help = 'Record where the last backup was saved.'

    def add_arguments(self, parser):
        parser.add_argument('backup_path', type=str)


    def handle(self, *args, **options):
        backup_path = options['backup_path']
        cache.set('backup_path', backup_path)
        self.stdout.write('Set backup path to: ' + backup_path)

