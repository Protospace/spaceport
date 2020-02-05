import time
import ldap
import ldap.modlist as modlist
from secrets import *
import base64

ldap.set_option(ldap.OPT_X_TLS_REQUIRE_CERT, ldap.OPT_X_TLS_NEVER)
ldap.set_option(ldap.OPT_X_TLS_CACERTFILE, LDAP_CERT)
l = ldap.initialize('ldaps://ldap.ps.protospace.ca:636')
l.set_option(ldap.OPT_REFERRALS, 0)
l.set_option(ldap.OPT_PROTOCOL_VERSION, 3)
l.set_option(ldap.OPT_X_TLS,ldap.OPT_X_TLS_DEMAND)
l.set_option(ldap.OPT_X_TLS_DEMAND, True)
l.set_option(ldap.OPT_DEBUG_LEVEL, 255)

# === Protospace ===
BASE = 'DC=ps,DC=protospace,DC=ca'
BASE_Members = 'OU=XTest,OU=GroupsOU,DC=ps,DC=protospace,DC=ca'
BASE_Groups  = 'OU=GroupsOU,DC=ps,DC=protospace,DC=ca'

def search(query):
    '''
    Search for a user by sAMAccountname
    '''
    try:
        bind = l.simple_bind_s(LDAP_USERNAME, LDAP_PASSWORD)

        criteria = '(&(objectClass=user)(sAMAccountName={})(!(objectClass=computer)))'.format(query)
        results = l.search_s(BASE_Members, ldap.SCOPE_SUBTREE, criteria, ['displayName','sAMAccountName','email'] )

        print(" =============")
        print(" Found %d Objects" % len(results))
        print(" =============")
        
        for result in results:
            dn, attr = result
            print(dn, attr)
        
        if (len(results) == 1):
            print("length = 1")
        
        return(len(results))
        
    finally:
        l.unbind()

def finduser(query):
    '''
    Search for a user by sAMAccountname
    '''
    try:
        bind = l.simple_bind_s(LDAP_USERNAME, LDAP_PASSWORD)

        criteria = '(&(objectClass=user)(sAMAccountName={})(!(objectClass=computer)))'.format(query)
        results = l.search_s(BASE_Groups, ldap.SCOPE_SUBTREE, criteria, ['displayName','sAMAccountName','email'] )

        print(" =============")
        print(" Found %d Objects" % len(results))
        print(" =============")
        count = len(results)
        rCode = count
        
        if (count == 0):
            rCode = "None"
        elif (count == 1):
            for result in results:
                #print("   --- ")
                #print(results)
                dn, attr = result
                print(dn, attr)
            rCode = dn
        else:
            for result in results:
                #print("   --- ")
                #print(results)
                dn, attr = result
                print(dn, attr)
            rCode(" Found %d Objects" % len(results))
            
    except Exception as inst:
        print("== Entering Except ==")
        rCode = type(inst)
        print(type(inst))    # the exception instance
        
    finally:
        l.unbind()
        return(rCode)

def findgroup(query):
    '''
    Search for a group by sAMAccountname
    '''
    try:
        bind = l.simple_bind_s(LDAP_USERNAME, LDAP_PASSWORD)

        criteria = '(&(objectClass=group)(sAMAccountName={}))'.format(query)
        results = l.search_s(BASE_Groups, ldap.SCOPE_SUBTREE, criteria, ['displayName','sAMAccountName'] )

        for result in results:
            #print("   --- ")
            #print(results)
            dn, attr = result
            print(dn, attr)
        
        rCode = "OK"

    except Exception as inst:
        print("== Entering Except ==")
        rCode = type(inst)
        print(type(inst))    # the exception instance
        
    finally:
        l.unbind()
        return(rCode)

def create_user(first, last, username, email, password):
    '''
    Create a User;  required data is first, last, email, username, password
    Note: this creates a disabled user, then sets a password, then enables the user
    '''
    try:
        bind = l.simple_bind_s(LDAP_USERNAME, LDAP_PASSWORD)
        dn = 'CN={} {},{}'.format(first, last, BASE_Members)
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
        ]

        l.add_s(dn, ldif)
        rCode = "OK"

        # set password
        pass_quotes = '"{}"'.format(password)
        pass_uni = pass_quotes.encode('utf-16-le')
        change_des = [(ldap.MOD_REPLACE, 'unicodePwd', [pass_uni])]
        result = l.modify_s(dn, change_des)

        # 512 will set user account to enabled
        mod_acct = [(ldap.MOD_REPLACE, 'userAccountControl', b'512')]
        result = l.modify_s(dn, mod_acct)
        
    except Exception as inst:
        print("== Entering Except ==")
        rCode = type(inst)
        print(type(inst))    # the exception instance
        
    else:
        #rCode = "Else"
        print("== Entering Else ==")
        
    finally:
        print("== Entering Finally ==")
        l.unbind()
        return(rCode)

def create_group(groupname):
    '''
    Create a group, for proof of concept, will usually be done manually
    '''
    try:
        dn = 'CN={},{}'.format(groupname, BASE)
        bind = l.simple_bind_s(LDAP_USERNAME, LDAP_PASSWORD)

        ldif = [
            ('objectClass', [b'group']),
            ('groupType', [b'-2147483646']),
            ('cn', [groupname.encode()]),
            ('name', [groupname.encode()]),
            ('sAMAccountName', [groupname.encode()]),
        ]

        l.add_s(dn, ldif)

    finally:
        l.unbind()

if __name__ == '__main__':
    
# ===========================================
#  Sample Progams
# ===========================================
    print("----------------------------------------------------------------------------------------")
    i = 3
    
    if ( i == 1):
        rCode = finduser('*')
    elif (i == 2):
        rCode = search('*')
    elif (i == 3):
        rCode = create_user(
        'billy',
        'gates',
        'billy.gates',
        'billy.gates@protospace.ca',
        'P@ssw0rd99'
        )
    elif ( i == 4):
        create_group('testgroup')
    else:
        print("No function selected")
        
        
    print("ReturnCode = " + str(rCode))
    

