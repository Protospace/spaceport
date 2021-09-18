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

## Changes

09/17/2021: An error in the LDAP functionality was discovered when the proposed user name exceeded 20 characters.  Unfortunately Active Directory has this limitation in the length of the sAMAccountName attribute in order to provide backward compatibility to pre-win2000 calls.  
It was realized that an assumption had been made that the login name and the sAMAccountName were interchangable.  This has been fixed. 
