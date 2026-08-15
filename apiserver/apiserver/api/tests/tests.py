from django.test import TestCase
import datetime
from dateutil import relativedelta
from rest_framework.exceptions import ValidationError
from rest_framework.test import APIClient

from apiserver.api import utils, utils_paypal, models


#class RegistrationTest(TestCase):
#    def test_registration_success(self):
#        client = APIClient()
#        data = {
#            'email': 'john@example.com',
#            'first_name': 'John',
#            'last_name': 'Doe',
#            'preferred_name': 'John',
#            'existing_member': 'false',
#            'password1': 'test123456',
#            'password2': 'test123456',
#            'ready_to_pay': 'true',
#            'username': 'john.doe',
#            'request_id': 'cevps1w1im',
#        }
#        response = client.post('/registration/', data)
#        self.assertEqual(response.status_code, 201)
#
#        # Check user was created
#        self.assertTrue(models.User.objects.filter(username='john.doe').exists())
#
#        # Check member was created
#        self.assertTrue(models.Member.objects.filter(user__username='john.doe').exists())
#
#        member = models.Member.objects.get(user__username='john.doe')
#        self.assertEqual(member.first_name, 'John')
#        self.assertEqual(member.last_name, 'Doe')
#        self.assertEqual(member.user.email, 'john@example.com')
