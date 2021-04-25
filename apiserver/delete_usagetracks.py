import django, sys, os
os.environ['DJANGO_SETTINGS_MODULE'] = 'apiserver.settings'
django.setup()

from apiserver.api import models

indexs = models.HistoryIndex.objects.filter(object_name='UsageTrack')
count = indexs.delete()
print(count, 'indexs deleted')

changes = models.HistoryChange.objects.filter(field='num_seconds')
count = changes.delete()
print(count, 'changes deleted')
