import django, sys, os
os.environ['DJANGO_SETTINGS_MODULE'] = 'apiserver.settings'
django.setup()

from apiserver.api import models

print()

if len(sys.argv) != 3:
    print('Invalid arguments.')
    print('Usage: python delete_course_merge_into.py 123 456')
    os._exit(1)

course_to_delete_id = sys.argv[1]
course_merge_into_id = sys.argv[2]

course_to_delete = models.Course.objects.get(id=course_to_delete_id)
course_merge_into = models.Course.objects.get(id=course_merge_into_id)

print('Delete course', course_to_delete_id, course_to_delete.name)
print('and merge into', course_merge_into_id, course_merge_into.name, '?')
print('ENTER to continue, ctrl-c to abort.')
try:
    input()
except KeyboardInterrupt:
    print('\nCancelled.')
    os._exit(0)

interests = course_to_delete.interests

print('Deleting', interests.count(), 'interests...')
interests.all().delete()

sessions = course_to_delete.sessions
print('Moving', sessions.count(), 'sessions...')
sessions.update(course=course_merge_into)

print('Deleting course...')
course_to_delete.delete()
