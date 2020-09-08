# LDAP Server

Runs inside Protospace's network and talks to Active Directory.

Exposes a REST API to Spaceport that allows managing AD users and passwords.

## Setup

https://docs.my.protospace.ca/ldap.html

## License

This program is free and open-source software licensed under the MIT License. Please see the `LICENSE` file for details.

That means you have the right to study, change, and distribute the software and source code to anyone and for any purpose. You deserve these rights.

## Acknowledgements

Thanks to Pat S for all his help integrating with Active Directory.

## Changes in this branch

Added 4 functions for managing groups:
- Add Group
- list Group (Lists members of the group)
- Add_to_group (Add a user to a group)
- is_member (Checks to see if a user is a member of a group.)
