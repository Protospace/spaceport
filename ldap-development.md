# Start development LDAP instance

`docker-compose -f docker-compose.dev.yml up samba`
Use `up -d samba` to run in background

# Start LDAPServer

`docker-compose -f docker-compose.dev.yml up ldapserver`

# Test

SEED DATA!
Will have to run tests inside the `ldapserver` container right now:

`docker exec spaceport_ldapserver_1 python -m unittest test_external.py`

## TODOs

- figure out TLS issue. should/can we just replicate that in development? it is currently preventing Seeding AD data....
- Figure out how to let `ldapserver` running on localhost interact with a dockerized AD-DC
- What is our LDAP structure? Does it matter? Should we replicate that here? How do we? IaC?
