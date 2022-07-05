from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase
from apiserver.api.models import Member, User
import json
from parameterized import parameterized

data = {
        "username": "registrationtc",
        "email": "unittest@email.com",
        "password1": "unittest",
        "password2": "unittest",
        "first_name": "John",
        "last_name": "Doe",

        # need to fake this for updating progress
        "request_id": "lol"
        }


class RegistrationTests(APITestCase):
    def setUp(self):
        self.url = reverse('rest_name_register')
        # TODO: expose data to be used for E2E testing from a webclient
        self.data = data
        # TODO: match with config
        self.allowed_ip = '24.66.110.96'

    def test_success(self):
        """Ensure we can create a new account object."""
        response = self.client.post(
                self.url, 
                self.data, 
                format='json', 
                HTTP_X_REAL_IP=self.allowed_ip
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        user = User.objects.get(username=self.data['username'])
        assert user is not None
        assert Member.objects.get(user=user) is not None

    def test_allowed_ip_wrong(self):
        """Ensure creation only allowed when HTTP_X_REAL_IP header matched IP in whitelist"""
        response = self.client.post(
                self.url, 
                self.data, 
                format='json', 
                HTTP_X_REAL_IP="0.0.0.0"
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    @parameterized.expand([(f"{key} is missing", key, status.HTTP_400_BAD_REQUEST) for key in data.keys() if key is not 'request_id'])
    def test_malformed_data(self, name, inp, expected):
        """Delete specific properties from data and confirm it is not accepted by API"""
        copy = self.data.copy()
        del copy[inp]
        response = self.client.post(
                self.url, 
                copy, 
                format='json', 
                HTTP_X_REAL_IP=self.allowed_ip
        )
        self.assertEqual(response.status_code, expected)
