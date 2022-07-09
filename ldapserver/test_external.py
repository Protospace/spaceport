import unittest
import secrets
import ldap_functions as ldapf

class TestExternalIntegration(unittest.TestCase):

    def test_create_user(self):
        ldapf.create_user("tanner", "collins", "tcollins", "tcollins@test.com", "iamtannercollins")

