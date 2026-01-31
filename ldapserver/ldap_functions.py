from log import logger
import time
import ldap
import ldap.modlist as modlist
from ldap.controls import SimplePagedResultsControl
import secrets
import base64

from flask import abort

HTTP_NOTFOUND = 404

ldap.set_option(ldap.OPT_X_TLS_REQUIRE_CERT, ldap.OPT_X_TLS_NEVER)
ldap.set_option(ldap.OPT_X_TLS_CACERTFILE, secrets.LDAP_CERTFILE)

def init_ldap():
    ldap_conn = ldap.initialize(secrets.LDAP_URL)
    ldap_conn.set_option(ldap.OPT_REFERRALS, 0)
    ldap_conn.set_option(ldap.OPT_PROTOCOL_VERSION, 3)
    ldap_conn.set_option(ldap.OPT_X_TLS,ldap.OPT_X_TLS_DEMAND)
    ldap_conn.set_option(ldap.OPT_X_TLS_DEMAND, True)
    ldap_conn.set_option(ldap.OPT_DEBUG_LEVEL, 255)

    return ldap_conn

def convert(data):
    if isinstance(data, dict):
        return {convert(key): convert(value) for key, value in data.items()}
    elif isinstance(data, (list, tuple)):
        if len(data) == 1:
            return convert(data[0])
        else:
            return [convert(element) for element in data]
    elif isinstance(data, (bytes, bytearray)):
        try:
            return data.decode()
        except UnicodeDecodeError:
            return data.hex()
    else:
        return data

def find_user(query):
    '''
    Search for a user by sAMAccountname or email
    '''
    ldap_conn = init_ldap()
    try:
        logger.info('Looking up user ' + query)
        ldap_conn.simple_bind_s(secrets.LDAP_USERNAME, secrets.LDAP_PASSWORD)
        criteria = '(&(objectClass=user)(|(mail={})(sAMAccountName={})(userPrincipalName={}*))(!(objectClass=computer)))'.format(query, query, query)
        results = ldap_conn.search_s(secrets.BASE_MEMBERS, ldap.SCOPE_SUBTREE, criteria, ['displayName','sAMAccountName','email'])

        logger.info('  Results: ' + str(results))

        if len(results) != 1:
            abort(HTTP_NOTFOUND)

        return results[0][0]
    finally:
        ldap_conn.unbind()

def find_dn(dn):
    '''
    Search for a user by dn
    '''
    ldap_conn = init_ldap()
    try:
        logger.info('Finding user for dn: ' + dn)
        ldap_conn.simple_bind_s(secrets.LDAP_USERNAME, secrets.LDAP_PASSWORD)
        criteria = '(&(objectClass=user)(!(objectClass=computer)))'
        results = ldap_conn.search_s(dn, ldap.SCOPE_SUBTREE, criteria, ['sAMAccountName'])

        logger.info('  Results: ' + str(results))

        return results[0][1]['sAMAccountName'][0].decode()
    finally:
        ldap_conn.unbind()

def create_user(first, last, username, email, password):
    '''
    Create a User;  required data is first, last, email, username, password
    Note: this creates a disabled user, then sets a password, then enables the user
    '''
    ldap_conn = init_ldap()
    try:
        logger.info('Creating user: ' + username)
        ldap_conn.simple_bind_s(secrets.LDAP_USERNAME, secrets.LDAP_PASSWORD)
        dn = 'CN={} {},{}'.format(first, last, secrets.BASE_MEMBERS)
        full_name = '{} {}'.format(first, last)

        ldif = [
            ('objectClass', [b'top', b'person', b'organizationalPerson', b'user']),
            ('cn', [full_name.encode()]),
            ('userPrincipalName', [username.encode()]),
            ('sAMAccountName', [username.encode()[:20]]),
            ('givenName', [first.encode()]),
            ('sn', [last.encode()]),
            ('DisplayName', [full_name.encode()]),
            ('userAccountControl', [b'514']),
            ('mail', [email.encode()]),
            ('company', [b'Spaceport']),
        ]

        result = ldap_conn.add_s(dn, ldif)

        logger.info('  Result: ' + str(result))

        # set password
        pass_quotes = '"{}"'.format(password)
        pass_uni = pass_quotes.encode('utf-16-le')
        change_des = [(ldap.MOD_REPLACE, 'unicodePwd', [pass_uni])]
        result = ldap_conn.modify_s(dn, change_des)

        logger.info('  Result: ' + str(result))

        # 512 will set user account to enabled
        mod_acct = [(ldap.MOD_REPLACE, 'userAccountControl', b'512')]
        result = ldap_conn.modify_s(dn, mod_acct)

        logger.info('  Result: ' + str(result))
    finally:
        ldap_conn.unbind()

def set_password(username, password):
    ldap_conn = init_ldap()
    try:
        logger.info('Setting password for: ' + username)
        ldap_conn.simple_bind_s(secrets.LDAP_USERNAME, secrets.LDAP_PASSWORD)
        user_dn = find_user(username)

        logger.info('  Dn found: ' + user_dn)

        # set password
        pass_quotes = '"{}"'.format(password)
        pass_uni = pass_quotes.encode('utf-16-le')
        change_des = [(ldap.MOD_REPLACE, 'unicodePwd', [pass_uni])]
        result = ldap_conn.modify_s(user_dn, change_des)

        logger.info('  Set password result: ' + str(result))
    finally:
        ldap_conn.unbind()

def find_group(groupname):
    '''
    Search for a group by name or sAMAccountname
    '''
    ldap_conn = init_ldap()
    try:
        logger.info('Looking up group ' + groupname)
        ldap_conn.simple_bind_s(secrets.LDAP_USERNAME, secrets.LDAP_PASSWORD)
        criteria = '(&(objectClass=group)(sAMAccountName={}))'.format(groupname)
        results = ldap_conn.search_s(secrets.BASE_GROUPS, ldap.SCOPE_SUBTREE, criteria, ['name','groupType'] )

        logger.info('  Results: ' + str(results))

        if len(results) != 1:
            abort(HTTP_NOTFOUND)

        return results[0][0]
    finally:
        ldap_conn.unbind()

def create_group(groupname, description):
    '''
    Create a Group;  required data is sAMAccountName, Description
    '''
    ldap_conn = init_ldap()
    try:
        ldap_conn.simple_bind_s(secrets.LDAP_USERNAME, secrets.LDAP_PASSWORD)
        dn = 'CN={},{}'.format(groupname, secrets.BASE_GROUPS)

        ldif = [
            ('objectClass', [b'top', b'group']),
            ('cn', [groupname.encode()]),
            ('DisplayName', [groupname.encode()]),
            ('description', [description.encode()]),
            ('sAMAccountName', [groupname.encode()])
        ]

        rcode = ldap_conn.add_s(dn, ldif)
        return rcode

    finally:
        ldap_conn.unbind()

def add_to_group(groupname, username):
    '''
    Add a user to a Group;  required data is GroupName, Username
    '''
    ldap_conn = init_ldap()
    try:
        logger.info('Adding ' + username + ' to group: ' + groupname)
        ldap_conn.simple_bind_s(secrets.LDAP_USERNAME, secrets.LDAP_PASSWORD)
        user_dn = find_user(username)
        group_dn = find_group(groupname)

        if not is_member(groupname, username):
            mod_acct = [(ldap.MOD_ADD, 'member', user_dn.encode())]
            ldap_conn.modify_s(group_dn, mod_acct)
            logger.info('  Added.')
            return True
        else:
            logger.info('  Already a member, skipping.')
            return False

    finally:
        ldap_conn.unbind()

def remove_from_group(groupname, username):
    '''
    Remove a user from a Group;  required data is GroupName, Username
    '''
    ldap_conn = init_ldap()
    try:
        ldap_conn.simple_bind_s(secrets.LDAP_USERNAME, secrets.LDAP_PASSWORD)
        user_dn = find_user(username)
        group_dn = find_group(groupname)

        if is_member(groupname, username):
            mod_acct = [(ldap.MOD_DELETE, 'member', user_dn.encode())]
            ldap_conn.modify_s(group_dn, mod_acct)
            return True
        else:
            logger.info('Not a member, skipping')
            return False

    finally:
        ldap_conn.unbind()

def list_group(groupname):
    '''
    List users in a Group;  required data is GroupName
    '''
    ldap_conn = init_ldap()
    try:
        ldap_conn.simple_bind_s(secrets.LDAP_USERNAME, secrets.LDAP_PASSWORD)
        group_dn = find_group(groupname)

        criteria = '(&(objectClass=group)(sAMAccountName={}))'.format(groupname)
        results = ldap_conn.search_s(secrets.BASE_GROUPS, ldap.SCOPE_SUBTREE, criteria, ['member'])
        members_tmp = results[0][1]
        members = members_tmp.get('member', [])
        return [find_dn(dn.decode()) for dn in members]

    finally:
        ldap_conn.unbind()

def delete_user(username):
    '''
    Delete user;  required data is sAMAccountName or userPrincipleName
    '''
    ldap_conn = init_ldap()
    try:
        logger.info('Deleting user: ' + username)

        ldap_conn.simple_bind_s(secrets.LDAP_USERNAME, secrets.LDAP_PASSWORD)
        user_dn = find_user(username)
        result = ldap_conn.delete_s(user_dn)

        logger.info('  Result: ' + str(result))
        return result

    finally:
        ldap_conn.unbind()

def is_member(groupname, username):
    '''
    Checks to see if a user is a member of a group
    '''
    ldap_conn = init_ldap()
    try:
        logger.info('Checking if ' + username + ' is in group: ' + groupname)
        ldap_conn.simple_bind_s(secrets.LDAP_USERNAME, secrets.LDAP_PASSWORD)
        group_dn = find_group(groupname)
        user_dn = find_user(username).encode()
        memflag = False
        criteria = '(&(objectClass=group)(sAMAccountName={}))'.format(groupname)
        results = ldap_conn.search_s(secrets.BASE_GROUPS, ldap.SCOPE_SUBTREE, criteria, ['member'] )
        members_tmp = results[0][1]
        members = members_tmp.get('member', [])
        result = user_dn in members

        logger.info('  Result: ' + str(result))
        return result
    finally:
        ldap_conn.unbind()

def dump_users():
    '''
    Dump all AD users
    '''
    ldap_conn = init_ldap()
    try:
        ldap_conn.simple_bind_s(secrets.LDAP_USERNAME, secrets.LDAP_PASSWORD)
        criteria = '(&(objectClass=user)(objectGUID=*))'
        attributes = ['cn', 'sAMAccountName', 'userPrincipalName', 'mail', 'displayName', 'givenName', 'name', 'sn', 'logonCount', 'objectGUID']

        page_control = SimplePagedResultsControl(True, size=1000, cookie=b'')

        results_list = []
        while True:
            msgid = ldap_conn.search_ext(
                secrets.BASE_MEMBERS,
                ldap.SCOPE_SUBTREE,
                criteria,
                attributes,
                serverctrls=[page_control]
            )

            rtype, rdata, rmsgid, serverctrls_out = ldap_conn.result3(msgid)

            # Filter out referrals
            results_list.extend([r for r in rdata if r[0] is not None])

            pctrls = [
                c for c in serverctrls_out if c.controlType == SimplePagedResultsControl.controlType
            ]
            if not pctrls:
                logger.warning("Server ignored paged results control")
                break

            cookie = pctrls[0].cookie
            if not cookie:
                break # No more pages

            page_control.cookie = cookie

        results = convert(results_list)

        output = {}
        for r in results:
            tmp = r[1]
            tmp['dn'] = r[0]
            output[r[1]['sAMAccountName']] = tmp

        import json
        return json.dumps(output, indent=4)
    finally:
        ldap_conn.unbind()

def set_account_enabled(username, is_enabled):
    ldap_conn = init_ldap()
    try:
        logger.info('Setting account enabled for: ' + username)
        ldap_conn.simple_bind_s(secrets.LDAP_USERNAME, secrets.LDAP_PASSWORD)
        criteria = '(&(objectClass=user)(sAMAccountName={})(!(objectClass=computer)))'.format(username)
        results = ldap_conn.search_s(
            secrets.BASE_MEMBERS,
            ldap.SCOPE_SUBTREE,
            criteria, [
                'displayName',
                'sAMAccountName',
                'email',
                'userAccountControl',
            ],
        )

        if len(results) != 1:
            abort(HTTP_NOTFOUND)

        try:
            dn = results[0][0]
            prev_control = results[0][1]['userAccountControl'][0]
        except KeyError:
            abort(HTTP_NOTFOUND)

        prev_control = int(prev_control.decode())

        if is_enabled:
            logger.info('Enabling account')
            new_control = prev_control & ~0x2
        else:
            logger.info('Disabling account')
            new_control = prev_control | 0x2

        logger.info('  Dn found: %s', dn)
        logger.info('  Current control: %s', prev_control)
        logger.info('  New control: %s', new_control)

        new_control = str(new_control).encode()

        mod_acct = [(ldap.MOD_REPLACE, 'userAccountControl', new_control)]
        result = ldap_conn.modify_s(dn, mod_acct)
        logger.info('  Result: ' + str(result)) 
        return result
    finally:
        ldap_conn.unbind()


# ===========================================================================

        #guid = '\\b4\\51\\1adce6709c449bd21a812c423e82'
        #guid = ''.join(['\\%s' % guid[i:i+2] for i in range(0, len(guid), 2)])
        #print(guid)
        #criteria = '(&(objectClass=user)(objectGUID={}))'.format(guid)

if __name__ == '__main__':
    pass
    print("=-=-=-=-=-=-=-=-=-=")
    #print(create_user('test', 'test', 'test.test', 'test@example.com', 'protospace*&^g87g6'))
    #print("----------")
    #print(find_user('elon.tusk'))
    #print("----------")
    #print(delete_user('elon.tusk'))
    #print("============================================================")
    #print(create_group("newgroup", "new group"))
    #print("   ==============  ")
    #print(list_group("Laser Users"))
    #print("   ==============  ")
    #print(is_member('newgroup','tanner.collin'))
    #print("   ==============  ")
    #print(add_to_group('newgroup','tanner.collin'))
    #print("   ==============  ")
    #print(list_group("newgroup"))
    #print("   ==============  ")
    #print(remove_from_group('newgroup','tanner.collin'))
    #print("   ==============  ")
    #print(list_group('Trotec Users'))
    #print(dump_users())

    #print(set_account_enabled('tanner.collin', True))

    #users = list_group('Laser Users')
    #import json
    #print(json.dumps(users, indent=4))
