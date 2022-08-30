# Generates missing LDAP users from Spaceport members
# this fixes an issue when a very old member resets their password
# and their LDAP user can't be found in the system.
#
# Assigns a random password to the user.


import django, sys, os
os.environ['DJANGO_SETTINGS_MODULE'] = 'apiserver.settings'
django.setup()

from apiserver.api import models, utils, utils_ldap
from uuid import uuid4
import re

random_password = lambda: str(uuid4())[:23]

members = models.Member.objects.all()

for member in members:
    print()

    username = member.user.username
    print('Checking LDAP for member id:', member.id, 'username:', username)

    if utils_ldap.is_configured():
        result = utils_ldap.find_user(member.user.username)
        if result == 200:
            print('    username found, skipping')
            continue

        print('    generating LDAP user...')

        data = dict(
            first_name=member.first_name,
            last_name=member.last_name,
            username=username,
            email=member.user.email,
            password1=random_password(),
        )
        result = utils_ldap.create_user(data)

        print('    result:', result)
