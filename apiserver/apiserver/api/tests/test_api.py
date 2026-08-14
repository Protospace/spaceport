from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase
from apiserver.api.models import Member, User
import json
import itertools
from django.utils import timezone
from parameterized import parameterized

from apiserver.api import utils, utils_paypal, models

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

class RoleBasedTests(APITestCase):
    @classmethod
    def setUpTestData(cls):
        from rest_framework.test import APIClient
        client = APIClient()
        cls.url = reverse('rest_name_register')
        cls.data = data

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

        first_member = None
        cls.users = []

        for i, combo in enumerate(combinations):
            if not combo:
                name_parts = ['Nothing']
            else:
                name_parts = [role_abbr[c] for c in combo]

            first_name = ' '.join(name_parts)
            username = '.'.join(name_parts).lower() + '.user'

            user_data = cls.data.copy()
            user_data['username'] = username
            user_data['email'] = f'{username}@email.com'
            user_data['first_name'] = first_name
            user_data['preferred_name'] = first_name
            user_data['last_name'] = 'User'

            response = client.post(
                cls.url,
                user_data,
                format='json',
            )
            assert response.status_code == status.HTTP_201_CREATED
            user = User.objects.get(username=username)
            member = Member.objects.get(user=user)

            is_admin = False
            if i == 0:
                user.is_staff = True
                user.is_superuser = True
                first_member = member
                is_admin = True

            if 'director' in combo:
                member.is_director = True
                is_admin = True
            if 'staff' in combo:
                user.is_staff = True
                member.is_staff = True
                is_admin = True
            if 'instructor' in combo:
                member.is_instructor = True
            if 'vetter' in combo:
                member.is_vetter = True
            if 'vetted' in combo:
                member.vetted_date = utils.today_local_tz()

            user.save()
            member.save()

            client.force_authenticate(user=user)
            details_response = client.patch(
                f'/members/{member.id}/',
                {'phone': '1234567890', 'helper_id': first_member.id},
                format='json'
            )
            assert details_response.status_code == status.HTTP_200_OK
            client.force_authenticate(user=None)
            
            cls.users.append({'user': user, 'is_admin': is_admin, 'member': member})

        cls.transactions = []
        for u in cls.users:
            tx = models.Transaction.objects.create(
                user=u['user'],
                amount=10,
                account_type='Cash',
                category='Donation',
                date=timezone.now().date()
            )
            cls.transactions.append(tx)

    def test_success(self):
        """Ensure we can create a new account object."""
        self.assertTrue(len(self.users) > 0)

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

    def test_transaction_permissions(self):
        list_url = '/transactions/'
        
        for u in self.users:
            user = u['user']
            is_admin = u['is_admin']
            self.client.force_authenticate(user=user)
            
            # Test List
            response = self.client.get(list_url)
            if is_admin:
                self.assertEqual(response.status_code, status.HTTP_200_OK)
            else:
                self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
                
            # Test Create
            data = {
                'member_id': u['member'].id,
                'date': timezone.now().date().isoformat(),
                'account_type': 'Cash',
                'category': 'Donation',
                'amount': 15.00
            }
            response = self.client.post(list_url, data, format='json')
            if is_admin:
                self.assertEqual(response.status_code, status.HTTP_201_CREATED)
            else:
                self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
                
            # Test Retrieve (Own)
            own_tx = models.Transaction.objects.filter(user=user).first()
            response = self.client.get(f'/transactions/{own_tx.id}/')
            self.assertEqual(response.status_code, status.HTTP_200_OK)
            
            # Test Retrieve (Other)
            other_tx = models.Transaction.objects.exclude(user=user).first()
            if other_tx:
                response = self.client.get(f'/transactions/{other_tx.id}/')
                if is_admin:
                    self.assertEqual(response.status_code, status.HTTP_200_OK)
                else:
                    self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
                    
            # Test Update
            response = self.client.patch(f'/transactions/{own_tx.id}/',
                    {'category': 'Donation', 'account_type': 'Cash', 'amount': 20.00, 'member_id': u['member'].id}, format='json')
            if is_admin:
                self.assertEqual(response.status_code, status.HTTP_200_OK)
            else:
                self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
                
            self.client.force_authenticate(user=None)
