import time
import ldap
import ldap.modlist as modlist
import secrets
import base64

from flask import abort

HTTP_NOTFOUND = 404
#BASE_MEMBERS = 'OU=Test,OU=GroupsOU,DC=ps,DC=protospace,DC=ca' # testing
BASE_MEMBERS = 'OU=MembersOU,DC=ps,DC=protospace,DC=ca' # prod

ldap.set_option(ldap.OPT_X_TLS_REQUIRE_CERT, ldap.OPT_X_TLS_NEVER)
ldap.set_option(ldap.OPT_X_TLS_CACERTFILE, './ProtospaceAD.cer')

def init_ldap():
    ldap_conn = ldap.initialize('ldaps://ldap.ps.protospace.ca:636')
    ldap_conn.set_option(ldap.OPT_REFERRALS, 0)
    ldap_conn.set_option(ldap.OPT_PROTOCOL_VERSION, 3)
    ldap_conn.set_option(ldap.OPT_X_TLS,ldap.OPT_X_TLS_DEMAND)
    ldap_conn.set_option(ldap.OPT_X_TLS_DEMAND, True)
    ldap_conn.set_option(ldap.OPT_DEBUG_LEVEL, 255)

    return ldap_conn

def find_user(username):
    '''
    Search for a user by sAMAccountname
    '''
    ldap_conn = init_ldap()
    try:
        ldap_conn.simple_bind_s(secrets.LDAP_USERNAME, secrets.LDAP_PASSWORD)
        criteria = '(&(objectClass=user)(sAMAccountName={})(!(objectClass=computer)))'.format(username)
        results = ldap_conn.search_s(BASE_MEMBERS, ldap.SCOPE_SUBTREE, criteria, ['displayName','sAMAccountName','email'] )

        if len(results) != 1:
            abort(HTTP_NOTFOUND)

        return results[0][0]
    finally:
        ldap_conn.unbind()

def create_user(first, last, username, email, password):
    '''
    Create a User;  required data is first, last, email, username, password
    Note: this creates a disabled user, then sets a password, then enables the user
    '''
    ldap_conn = init_ldap()
    try:
        ldap_conn.simple_bind_s(secrets.LDAP_USERNAME, secrets.LDAP_PASSWORD)
        dn = 'CN={} {},{}'.format(first, last, BASE_MEMBERS)
        full_name = '{} {}'.format(first, last)

        ldif = [
            ('objectClass', [b'top', b'person', b'organizationalPerson', b'user']),
            ('cn', [full_name.encode()]),
            ('userPrincipalName', [username.encode()]),
            ('sAMAccountName', [username.encode()]),
            ('givenName', [first.encode()]),
            ('sn', [last.encode()]),
            ('DisplayName', [full_name.encode()]),
            ('userAccountControl', [b'514']),
            ('mail', [email.encode()]),
            ('company', [b'Spaceport']),
        ]

        ldap_conn.add_s(dn, ldif)

        # set password
        pass_quotes = '"{}"'.format(password)
        pass_uni = pass_quotes.encode('utf-16-le')
        change_des = [(ldap.MOD_REPLACE, 'unicodePwd', [pass_uni])]
        result = ldap_conn.modify_s(dn, change_des)

        # 512 will set user account to enabled
        mod_acct = [(ldap.MOD_REPLACE, 'userAccountControl', b'512')]
        result = ldap_conn.modify_s(dn, mod_acct)
    finally:
        ldap_conn.unbind()

def set_password(username, password):
    ldap_conn = init_ldap()
    try:
        ldap_conn.simple_bind_s(secrets.LDAP_USERNAME, secrets.LDAP_PASSWORD)
        criteria = '(&(objectClass=user)(sAMAccountName={})(!(objectClass=computer)))'.format(username)
        results = ldap_conn.search_s(BASE_MEMBERS, ldap.SCOPE_SUBTREE, criteria, ['displayName','sAMAccountName','email'] )

        if len(results) != 1:
            abort(HTTP_NOTFOUND)

        dn = results[0][0]

        # set password
        pass_quotes = '"{}"'.format(password)
        pass_uni = pass_quotes.encode('utf-16-le')
        change_des = [(ldap.MOD_REPLACE, 'unicodePwd', [pass_uni])]
        result = ldap_conn.modify_s(dn, change_des)
    finally:
        ldap_conn.unbind()

if __name__ == '__main__':
    #print(find_user('tanner.collin'))
    print(set_password('dsaftanner.collin', 'Supersecret@@'))
