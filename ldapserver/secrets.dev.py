# LDAP server secrets file FOR DEVELOPMENT
# DO NOT USE IN PRODUCTION
#
# Auth token, used by Spaceport to authenticate
# Set this to random characters
# For example, use the first output of this:
# head /dev/urandom | sha1sum
AUTH_TOKEN = '332d963e1d52b31bf451e1483c86e958e21764ef'

LDAP_USERNAME = 'admin'
LDAP_PASSWORD = 'Passw0rd#'

LDAP_CERTFILE = ''
LDAP_URL = 'ldap://samba:389'

BASE_MEMBERS = ''
BASE_GROUPS = ''
