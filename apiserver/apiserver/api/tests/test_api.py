from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase
from apiserver.api.models import Member, User
import json
import itertools
from django.utils import timezone
from parameterized import parameterized

data = {
    'username': 'registrationtc',
    'email': 'unittest@email.com',
    'password1': 'unittest',
    'password2': 'unittest',
    'preferred_name': 'John',
    'first_name': 'John',
    'last_name': 'Doe',

    # need to fake this for updating progress
    'request_id': 'lol'
}

class RegistrationTests(APITestCase):
    def setUp(self):
        self.url = reverse('rest_name_register')
        # TODO: expose data to be used for E2E testing from a webclient
        self.data = data

    def test_success(self):
        """Ensure we can create a new account object."""
        roles = ['director', 'staff', 'instructor', 'vetter', 'vetted']
        combinations = [()] # nothing
        for r in range(1, len(roles) + 1):
            combinations.extend(itertools.combinations(roles, r))

        role_abbr = {
            'director': 'Dir',
            'staff': 'Staff',
            'instructor': 'Inst',
            'vetter': 'Vet',
            'vetted': 'Vtd'
        }

        for i, combo in enumerate(combinations):
            if not combo:
                name_parts = ['Nothing']
            else:
                name_parts = [role_abbr[c] for c in combo]

            first_name = ' '.join(name_parts)
            username = '.'.join(name_parts).lower() + '.user'

            user_data = self.data.copy()
            user_data['username'] = username
            user_data['email'] = f'{username}@email.com'
            user_data['first_name'] = first_name
            user_data['preferred_name'] = first_name
            user_data['last_name'] = 'User'

            response = self.client.post(
                self.url,
                user_data,
                format='json',
            )
            self.assertEqual(response.status_code, status.HTTP_201_CREATED)
            user = User.objects.get(username=username)
            member = Member.objects.get(user=user)

            if i == 0:
                self.assertTrue(user.is_staff)
                self.assertTrue(user.is_superuser)

            if 'director' in combo:
                member.is_director = True
            if 'staff' in combo:
                user.is_staff = True
                member.is_staff = True
            if 'instructor' in combo:
                member.is_instructor = True
            if 'vetter' in combo:
                member.is_vetter = True
            if 'vetted' in combo:
                member.vetted_date = timezone.now()

            user.save()
            member.save()

    @parameterized.expand([(f'{key} is missing', key, status.HTTP_400_BAD_REQUEST) for key in data.keys() if key != 'request_id'])
    def test_malformed_data(self, name, inp, expected):
        """Delete specific properties from data and confirm it is not accepted by API"""
        copy = self.data.copy()
        del copy[inp]
        response = self.client.post(
            self.url,
            copy,
            format='json',
        )
        self.assertEqual(response.status_code, expected)
