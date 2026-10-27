import base64
import io
import requests
from datetime import timedelta
from decimal import Decimal

from django.contrib.auth.tokens import default_token_generator
from django.core.cache import cache
from django.urls import Resolver404, reverse, resolve
from django.utils.encoding import force_bytes
from django.utils.http import urlsafe_base64_encode
from PIL import Image
from rest_framework.authtoken.models import Token
from rest_framework.test import APIClient

from rest_framework import status
from rest_framework.test import APITestCase
from apiserver.api.models import Member, User
import json
import itertools
from django.utils import timezone
from parameterized import parameterized
from django.test import override_settings
from unittest.mock import patch

from apiserver import secrets, settings
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

@override_settings(PASSWORD_HASHERS=['django.contrib.auth.hashers.MD5PasswordHasher'])
class RoleBasedTests(APITestCase):
    @classmethod
    def setUpTestData(cls):
        from rest_framework.test import APIClient
        client = APIClient(HTTP_X_REAL_IP='24.66.110.96')
        cls.url = reverse('rest_name_register')
        cls.data = data

        roles = ['director', 'staff', 'instructor', 'vetter', 'vetted']
        combinations = [(), ()] # start with first user (superuser) and a probationary
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

        from unittest.mock import patch
        patcher = patch('apiserver.api.utils.gen_member_forms')
        patcher.start()

        for i, combo in enumerate(combinations):
            if i == 0:
                name_parts = ['Super']
            elif i == 1:
                name_parts = ['Probationary']
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

            # Note: user.is_staff is a Django permission that grants access to
            # the admin web panel. member.is_staff is a Spaceport permission
            # that gives a member the same powers as a Director.
            # The first user is automatically granted user.is_staff and
            # user.is_superuser.

            if i == 0:
                first_member = member

            if 'director' in combo:
                member.is_director = True
            if 'staff' in combo:
                member.is_staff = True
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

            cls.users.append({'user': user, 'member': member})

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

        patcher.stop()

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

        # Test Unauthenticated
        self.client.force_authenticate(user=None)
        self.assertEqual(self.client.get(list_url).status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertEqual(self.client.post(list_url, {}, format='json').status_code, status.HTTP_401_UNAUTHORIZED)

        self.assertTrue(self.transactions, "No transactions available to test")
        tx_id = self.transactions[0].id
        self.assertEqual(self.client.get(f'/transactions/{tx_id}/').status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertEqual(self.client.patch(f'/transactions/{tx_id}/', {}, format='json').status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertEqual(self.client.put(f'/transactions/{tx_id}/', {}, format='json').status_code, status.HTTP_401_UNAUTHORIZED)

        for u in self.users:
            user = u['user']
            member = u['member']

            with self.subTest(user=user.username):
                self.client.force_authenticate(user=user)

                # Test List
                response = self.client.get(list_url)
                if user.is_staff or member.is_staff or member.is_director:
                    self.assertEqual(response.status_code, status.HTTP_200_OK)
                else:
                    self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

                # Test Create
                data = {
                    'member_id': member.id,
                    'date': timezone.now().date().isoformat(),
                    'account_type': 'Cash',
                    'category': 'Donation',
                    'amount': 15.00
                }
                response = self.client.post(list_url, data, format='json')
                if user.is_staff or member.is_staff or member.is_director:
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
                    if user.is_staff or member.is_staff or member.is_director:
                        self.assertEqual(response.status_code, status.HTTP_200_OK)
                    else:
                        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

                # Test Update (PATCH)
                response = self.client.patch(f'/transactions/{own_tx.id}/',
                        {'category': 'Donation', 'account_type': 'Cash', 'amount': 20.00, 'member_id': member.id}, format='json')
                if user.is_staff or member.is_staff or member.is_director:
                    self.assertEqual(response.status_code, status.HTTP_200_OK)
                else:
                    self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

                # Test Update (PUT)
                put_data = {
                    'member_id': member.id,
                    'date': timezone.now().date().isoformat(),
                    'account_type': 'Cash',
                    'category': 'Donation',
                    'amount': 25.00
                }
                response = self.client.put(f'/transactions/{own_tx.id}/', put_data, format='json')
                if user.is_staff or member.is_staff or member.is_director:
                    self.assertEqual(response.status_code, status.HTTP_200_OK)
                else:
                    self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

                # Test Delete (should fail for everyone)
                response = self.client.delete(f'/transactions/{own_tx.id}/')
                self.assertEqual(response.status_code, status.HTTP_405_METHOD_NOT_ALLOWED)

                self.client.force_authenticate(user=None)

    def test_course_permissions(self):
        list_url = '/courses/'
        course = models.Course.objects.create(name='Initial Course', description='Desc')

        # Test Unauthenticated
        self.client.force_authenticate(user=None)
        self.assertEqual(self.client.get(list_url).status_code, status.HTTP_200_OK)
        self.assertEqual(self.client.get(f'/courses/{course.id}/').status_code, status.HTTP_200_OK)
        self.assertEqual(self.client.post(list_url, {'name': 'New'}, format='json').status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertEqual(self.client.patch(f'/courses/{course.id}/', {'name': 'Updated'}, format='json').status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertEqual(self.client.put(f'/courses/{course.id}/', {'name': 'Updated', 'description': 'Desc'}, format='json').status_code, status.HTTP_401_UNAUTHORIZED)

        for u in self.users:
            user = u['user']
            member = u['member']

            with self.subTest(user=user.username):
                self.client.force_authenticate(user=user)

                # Test List & Retrieve
                self.assertEqual(self.client.get(list_url).status_code, status.HTTP_200_OK)
                self.assertEqual(self.client.get(f'/courses/{course.id}/').status_code, status.HTTP_200_OK)

                # Test Create
                data = {
                    'name': f'New Course {user.username}',
                    'description': 'A new course'
                }
                response = self.client.post(list_url, data, format='json')
                if user.is_staff or member.is_staff or member.is_director or member.is_instructor:
                    self.assertEqual(response.status_code, status.HTTP_201_CREATED)
                else:
                    self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

                # Test Update (PATCH)
                response = self.client.patch(f'/courses/{course.id}/', {'name': f'Updated {user.username}'}, format='json')
                if user.is_staff or member.is_staff or member.is_director or member.is_instructor:
                    self.assertEqual(response.status_code, status.HTTP_200_OK)
                else:
                    self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

                # Test Update (PUT)
                put_data = {
                    'name': f'Put Updated {user.username}',
                    'description': 'Put description'
                }
                response = self.client.put(f'/courses/{course.id}/', put_data, format='json')
                if user.is_staff or member.is_staff or member.is_director or member.is_instructor:
                    self.assertEqual(response.status_code, status.HTTP_200_OK)
                else:
                    self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

                # Test Delete (should fail for everyone since Destroy is not in CourseViewSet)
                response = self.client.delete(f'/courses/{course.id}/')
                if user.is_staff or member.is_staff or member.is_director or member.is_instructor:
                    self.assertEqual(response.status_code, status.HTTP_405_METHOD_NOT_ALLOWED)
                else:
                    self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

                self.client.force_authenticate(user=None)

    def test_session_permissions(self):
        list_url = '/sessions/'
        course = models.Course.objects.create(name='Session Test Course', description='Desc')

        # Create an initial session to test updates
        session = models.Session.objects.create(
            course=course,
            instructor=self.users[0]['user'],
            datetime=timezone.now() + timezone.timedelta(days=2),
            cost=10,
            max_students=5
        )

        # Test Unauthenticated
        self.client.force_authenticate(user=None)
        self.assertEqual(self.client.get(list_url).status_code, status.HTTP_200_OK)
        self.assertEqual(self.client.get(f'/sessions/{session.id}/').status_code, status.HTTP_200_OK)
        self.assertEqual(self.client.post(list_url, {}, format='json').status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertEqual(self.client.patch(f'/sessions/{session.id}/', {}, format='json').status_code, status.HTTP_401_UNAUTHORIZED)

        from unittest.mock import patch

        for u in self.users:
            user = u['user']
            member = u['member']

            with self.subTest(user=user.username):
                self.client.force_authenticate(user=user)

                # Test List & Retrieve
                self.assertEqual(self.client.get(list_url).status_code, status.HTTP_200_OK)
                self.assertEqual(self.client.get(f'/sessions/{session.id}/').status_code, status.HTTP_200_OK)

                # Test Create
                data = {
                    'course': course.id,
                    'instructor_id': member.id,
                    'datetime': (timezone.now() + timezone.timedelta(days=5)).isoformat(),
                    'cost': 15.00,
                    'max_students': 5,
                    'request_id': 'test_req_id'
                }
                response = self.client.post(list_url, data, format='json')
                if user.is_staff or member.is_staff or member.is_director or member.is_instructor:
                    self.assertEqual(response.status_code, status.HTTP_201_CREATED)
                else:
                    self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

                # Test Update (PATCH)
                response = self.client.patch(f'/sessions/{session.id}/', {'cost': 20.00, 'instructor_id': member.id}, format='json')
                if user.is_staff or member.is_staff or member.is_director or member.is_instructor:
                    self.assertEqual(response.status_code, status.HTTP_200_OK)
                else:
                    self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

                # Test Delete (should fail for everyone since Destroy is not in SessionViewSet)
                response = self.client.delete(f'/sessions/{session.id}/')
                if user.is_staff or member.is_staff or member.is_director or member.is_instructor:
                    self.assertEqual(response.status_code, status.HTTP_405_METHOD_NOT_ALLOWED)
                else:
                    self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

                self.client.force_authenticate(user=None)

        # Test invalid creation/modification (past class > 1 week)
        privileged_user = next(u for u in self.users if u['member'].is_instructor)['user']
        privileged_member = privileged_user.member
        self.client.force_authenticate(user=privileged_user)

        past_date = (timezone.now() - timezone.timedelta(days=8)).isoformat()

        with patch('apiserver.api.utils.alert_tanner') as mock_alert:
            # Invalid Create
            data = {
                'course': course.id,
                'instructor_id': privileged_member.id,
                'datetime': past_date,
                'cost': 15.00,
                'max_students': 5,
                'request_id': 'test_req_id'
            }
            response = self.client.post(list_url, data, format='json')
            self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
            self.assertTrue(mock_alert.called)
            self.assertIn('Past class creation detected', mock_alert.call_args[0][0])

        with patch('apiserver.api.utils.alert_tanner') as mock_alert:
            # Invalid Update
            response = self.client.patch(f'/sessions/{session.id}/', {'datetime': past_date, 'instructor_id': privileged_member.id, 'max_students': 5}, format='json')
            self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
            self.assertTrue(mock_alert.called)
            self.assertIn('Past class modification detected', mock_alert.call_args[0][0])

        self.client.force_authenticate(user=None)

    def test_transaction_serializer_logic(self):
        # Find dir.vet.user
        user_dict = next(u for u in self.users if u['user'].username == 'dir.vet.user')
        user = user_dict['user']
        member = user_dict['member']
        self.client.force_authenticate(user=user)

        list_url = '/transactions/'
        base_data = {
            'member_id': 2,  # the Probationary User
            'date': utils.today_local_tz(),
            'account_type': 'Cash',
            'category': 'Donation',
            'amount': 10.00
        }

        # Missing member_id
        data = base_data.copy()
        del data['member_id']
        response = self.client.post(list_url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

        # Membership without months
        data = base_data.copy()
        data['category'] = 'Membership'
        response = self.client.post(list_url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

        # Protocoin Exchange
        data = base_data.copy()
        data['account_type'] = 'Protocoin'
        data['category'] = 'Exchange'
        response = self.client.post(list_url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

        # Exchange with 0 amount
        data = base_data.copy()
        data['category'] = 'Exchange'
        data['amount'] = 0
        response = self.client.post(list_url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

        # Protocoin with 0 protocoin
        data = base_data.copy()
        data['account_type'] = 'Protocoin'
        data['protocoin'] = 0
        response = self.client.post(list_url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

        # Cash with 0 amount
        data = base_data.copy()
        data['account_type'] = 'Cash'
        data['amount'] = 0
        response = self.client.post(list_url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

        # Interac without reference_number
        data = base_data.copy()
        data['account_type'] = 'Interac'
        response = self.client.post(list_url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

        # Negative protocoin without sufficient funds
        data = base_data.copy()
        data['account_type'] = 'Protocoin'
        data['category'] = 'Snacks'
        data['protocoin'] = -1000.00
        response = self.client.post(list_url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

        # Valid Exchange
        data = base_data.copy()
        data['category'] = 'Exchange'
        data['amount'] = 50.00
        response = self.client.post(list_url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(float(response.data['protocoin']), 50.00)

        # Valid Protocoin spend
        data = base_data.copy()
        data['account_type'] = 'Protocoin'
        data['category'] = 'Snacks'
        data['protocoin'] = -5.00

        from unittest.mock import patch
        with patch('apiserver.api.utils.alert_tanner') as mock_alert:
            response = self.client.post(list_url, data, format='json')
            self.assertEqual(response.status_code, status.HTTP_201_CREATED)
            self.assertTrue(mock_alert.called)
            self.assertIn('Manual Protocoin transaction added', mock_alert.call_args[0][0])

        # Valid Membership transaction
        data = base_data.copy()
        data['category'] = 'Membership'
        data['number_of_membership_months'] = 1
        response = self.client.post(list_url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

        # Test Update logic (subtracting out the transaction being edited)
        tx_id = response.data['id']
        update_data = data.copy()
        update_data['account_type'] = 'Protocoin'
        update_data['category'] = 'Snacks'
        update_data['protocoin'] = -1000.00 # Allowed, but triggers alert

        from unittest.mock import patch
        with patch('apiserver.api.utils.alert_tanner') as mock_alert:
            response = self.client.patch(f'/transactions/{tx_id}/', update_data, format='json')
            self.assertEqual(response.status_code, status.HTTP_200_OK)
            self.assertTrue(mock_alert.called)
            self.assertIn('Negative Protocoin transaction updated', mock_alert.call_args[0][0])

        # Valid PayPal transaction
        data = base_data.copy()
        data['account_type'] = 'PayPal'
        data['category'] = 'Donation'
        data['amount'] = 10.00
        data['reference_number'] = 'PAYPAL123'

        with patch('apiserver.api.utils.alert_tanner') as mock_alert:
            response = self.client.post(list_url, data, format='json')
            self.assertEqual(response.status_code, status.HTTP_201_CREATED)
            self.assertTrue(mock_alert.called)
            self.assertIn('Manual PayPal transaction added', mock_alert.call_args[0][0])

        self.client.force_authenticate(user=None)

    def test_protocoin_spend_request(self):
        user_dict = next(u for u in self.users if u['user'].username == 'vet.user')
        user = user_dict['user']
        self.client.force_authenticate(user=user)

        # Give user some protocoin
        models.Transaction.objects.create(
            user=user,
            protocoin=100.00,
            amount=0,
            account_type='Protocoin',
            category='Exchange',
            date=timezone.now().date()
        )

        url = '/protocoin/spend_request/'
        base_data = {
            'balance': 100.00,
            'amount': 10.00,
            'category': 'Consumables'
        }

        # Missing balance
        data = base_data.copy()
        del data['balance']
        self.assertEqual(self.client.post(url, data, format='json').status_code, status.HTTP_400_BAD_REQUEST)

        # Invalid balance
        data = base_data.copy()
        data['balance'] = 'abc'
        self.assertEqual(self.client.post(url, data, format='json').status_code, status.HTTP_400_BAD_REQUEST)

        # Missing amount
        data = base_data.copy()
        del data['amount']
        self.assertEqual(self.client.post(url, data, format='json').status_code, status.HTTP_400_BAD_REQUEST)

        # Invalid category
        data = base_data.copy()
        data['category'] = 'Invalid'
        self.assertEqual(self.client.post(url, data, format='json').status_code, status.HTTP_400_BAD_REQUEST)

        # Amount too small
        data = base_data.copy()
        data['amount'] = 0.01
        self.assertEqual(self.client.post(url, data, format='json').status_code, status.HTTP_400_BAD_REQUEST)

        # Incorrect balance
        data = base_data.copy()
        data['balance'] = 90.00
        self.assertEqual(self.client.post(url, data, format='json').status_code, status.HTTP_400_BAD_REQUEST)

        # Insufficient funds
        data = base_data.copy()
        data['amount'] = 200.00
        self.assertEqual(self.client.post(url, data, format='json').status_code, status.HTTP_400_BAD_REQUEST)

        # Valid spend
        response = self.client.post(url, base_data, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        self.client.force_authenticate(user=None)

    def test_protocoin_send_to_member(self):
        user_dict = next(u for u in self.users if u['user'].username == 'vet.user')
        user = user_dict['user']
        member = user_dict['member']

        target_dict = next(u for u in self.users if u['user'].username == 'vtd.user')
        target_member = target_dict['member']

        self.client.force_authenticate(user=user)

        # Give user some protocoin
        models.Transaction.objects.create(
            user=user,
            protocoin=100.00,
            amount=0,
            account_type='Protocoin',
            category='Exchange',
            date=timezone.now().date()
        )

        url = '/protocoin/send_to_member/'
        base_data = {
            'member_id': target_member.id,
            'balance': 100.00,
            'amount': 10.00,
            'memo': 'Thanks for the help!'
        }

        # Missing member_id
        data = base_data.copy()
        del data['member_id']
        self.assertEqual(self.client.post(url, data, format='json').status_code, status.HTTP_400_BAD_REQUEST)

        # Invalid member_id
        data = base_data.copy()
        data['member_id'] = 'abc'
        self.assertEqual(self.client.post(url, data, format='json').status_code, status.HTTP_400_BAD_REQUEST)

        # Missing balance
        data = base_data.copy()
        del data['balance']
        self.assertEqual(self.client.post(url, data, format='json').status_code, status.HTTP_400_BAD_REQUEST)

        # Invalid balance
        data = base_data.copy()
        data['balance'] = 'abc'
        self.assertEqual(self.client.post(url, data, format='json').status_code, status.HTTP_400_BAD_REQUEST)

        # Missing amount
        data = base_data.copy()
        del data['amount']
        self.assertEqual(self.client.post(url, data, format='json').status_code, status.HTTP_400_BAD_REQUEST)

        # Invalid amount
        data = base_data.copy()
        data['amount'] = 'abc'
        self.assertEqual(self.client.post(url, data, format='json').status_code, status.HTTP_400_BAD_REQUEST)

        # Amount too small
        data = base_data.copy()
        data['amount'] = 0.50
        self.assertEqual(self.client.post(url, data, format='json').status_code, status.HTTP_400_BAD_REQUEST)

        # Send to self
        data = base_data.copy()
        data['member_id'] = member.id
        self.assertEqual(self.client.post(url, data, format='json').status_code, status.HTTP_400_BAD_REQUEST)

        # Incorrect balance
        data = base_data.copy()
        data['balance'] = 90.00
        self.assertEqual(self.client.post(url, data, format='json').status_code, status.HTTP_400_BAD_REQUEST)

        # Insufficient funds
        data = base_data.copy()
        data['amount'] = 200.00
        self.assertEqual(self.client.post(url, data, format='json').status_code, status.HTTP_400_BAD_REQUEST)

        # Valid send
        response = self.client.post(url, base_data, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        self.client.force_authenticate(user=None)

    def test_protocoin_card_vend_request(self):
        user_dict = next(u for u in self.users if u['user'].username == 'vet.user')
        user = user_dict['user']

        card = models.Card.objects.create(
            user=user,
            card_number='VENDCARD123',
            active_status='card_active'
        )

        # Give user some protocoin
        models.Transaction.objects.create(
            user=user,
            protocoin=100.00,
            amount=0,
            account_type='Protocoin',
            category='Exchange',
            date=timezone.now().date()
        )

        url = f'/protocoin/{card.card_number}/card_vend_request/'
        base_data = {
            'machine': 'Snack',
            'number': 'A1',
            'balance': 100.00,
            'amount': 2.50
        }

        from unittest.mock import patch
        with patch('apiserver.api.views.secrets.VEND_API_TOKEN', 'testtoken'):
            # Missing auth
            self.assertEqual(self.client.post(url, base_data, format='json').status_code, status.HTTP_403_FORBIDDEN)

            auth_headers = {'HTTP_AUTHORIZATION': 'Bearer testtoken'}

            # Missing number
            data = base_data.copy()
            del data['number']
            self.assertEqual(self.client.post(url, data, format='json', **auth_headers).status_code, status.HTTP_400_BAD_REQUEST)

            # Missing balance
            data = base_data.copy()
            del data['balance']
            self.assertEqual(self.client.post(url, data, format='json', **auth_headers).status_code, status.HTTP_400_BAD_REQUEST)

            # Invalid balance
            data = base_data.copy()
            data['balance'] = 'abc'
            self.assertEqual(self.client.post(url, data, format='json', **auth_headers).status_code, status.HTTP_400_BAD_REQUEST)

            # Missing amount
            data = base_data.copy()
            del data['amount']
            self.assertEqual(self.client.post(url, data, format='json', **auth_headers).status_code, status.HTTP_400_BAD_REQUEST)

            # Invalid amount
            data = base_data.copy()
            data['amount'] = 'abc'
            self.assertEqual(self.client.post(url, data, format='json', **auth_headers).status_code, status.HTTP_400_BAD_REQUEST)

            # Amount too small
            data = base_data.copy()
            data['amount'] = 0.01
            self.assertEqual(self.client.post(url, data, format='json', **auth_headers).status_code, status.HTTP_400_BAD_REQUEST)

            # Incorrect balance
            data = base_data.copy()
            data['balance'] = 90.00
            self.assertEqual(self.client.post(url, data, format='json', **auth_headers).status_code, status.HTTP_400_BAD_REQUEST)

            # Insufficient funds
            data = base_data.copy()
            data['amount'] = 200.00
            self.assertEqual(self.client.post(url, data, format='json', **auth_headers).status_code, status.HTTP_400_BAD_REQUEST)

            # Valid vend
            response = self.client.post(url, base_data, format='json', **auth_headers)
            self.assertEqual(response.status_code, status.HTTP_200_OK)

            # Instructor comp
            course = models.Course.objects.create(name='Test Course')
            session = models.Session.objects.create(
                course=course,
                instructor=user,
                datetime=timezone.now(),
                cost=3
            )

            comp_data = base_data.copy()
            comp_data['balance'] = 97.50

            with patch('apiserver.api.utils.alert_tanner') as mock_alert:
                response = self.client.post(url, comp_data, format='json', **auth_headers)
                self.assertEqual(response.status_code, status.HTTP_200_OK)
                self.assertTrue(mock_alert.called)
                self.assertIn('Instructor', mock_alert.call_args[0][0])


class AuthTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(username='test.user', email='test@example.com', password='oldpassword')
        self.member = models.Member.objects.create(user=self.user, preferred_name='Test', last_name='User', set_details=True)

    def test_login_serializer(self):
        from apiserver.api.serializers import MyLoginSerializer

        invalid_usernames = [
            ('firstlast', 'Username should have a period. Try "first.last" or "first.middle.last".'),
            ('first-last', 'Username shouldn\'t have dashes. Try "first.last" or "first.last.name".'),
            ('first last', 'Username shouldn\'t have spaces. Try "first.last" or "first.middle.last".'),
            ('first.last', 'Don\'t literally try "first.last", use your own name.'),
            ('first.middle.last', 'Don\'t literally try "first.middle.last", use your own name.'),
            ('does.not.exist', 'Username not found. Try "first.last" or "first.middle.last".'),
        ]

        mock_request = type('Request', (), {})()
        for username, expected_error in invalid_usernames:
            serializer = MyLoginSerializer(data={'username': username, 'password': 'password'}, context={'request': mock_request})
            self.assertFalse(serializer.is_valid())
            self.assertEqual(serializer.errors['username'][0], expected_error)

        # Test wrong password
        serializer = MyLoginSerializer(data={'username': 'test.user', 'password': 'wrongpassword'}, context={'request': mock_request})
        self.assertFalse(serializer.is_valid())
        self.assertEqual(serializer.errors['password'][0], 'Incorrect password. Check caps lock.')

        # Test correct login
        serializer = MyLoginSerializer(data={'username': 'test.user', 'password': 'oldpassword'}, context={'request': mock_request})
        self.assertTrue(serializer.is_valid())

    @patch('apiserver.api.utils_ldap.is_configured', return_value=False)
    @patch('apiserver.api.utils_auth.discourse_is_configured', return_value=False)
    def test_password_change_serializer(self, mock_discourse, mock_ldap):
        from apiserver.api.serializers import MyPasswordChangeSerializer

        class MockSession(dict):
            def cycle_key(self):
                pass

        mock_session = MockSession()
        request = type('Request', (), {'data': {'new_password1': 'ComplexPass123!', 'request_id': '123'}, 'user': self.user, 'session': mock_session})()
        serializer = MyPasswordChangeSerializer(
            data={'old_password': 'oldpassword', 'new_password1': 'ComplexPass123!', 'new_password2': 'ComplexPass123!'},
            context={'request': request}
        )

        self.assertTrue(serializer.is_valid())
        serializer.save()

        self.user.refresh_from_db()
        self.assertTrue(self.user.check_password('ComplexPass123!'))

    def test_password_reset_serializer(self):
        from apiserver.api.serializers import MyPasswordResetSerializer

        # Test valid email
        serializer = MyPasswordResetSerializer(data={'email': 'test@example.com'}, context={'request': None})
        self.assertTrue(serializer.is_valid())

        # Test invalid email
        invalid_serializer = MyPasswordResetSerializer(data={'email': 'wrong@example.com'}, context={'request': None})
        self.assertFalse(invalid_serializer.is_valid())
        self.assertEqual(invalid_serializer.errors['email'][0], 'Not found.')

    def test_duplicate_email_registration(self):
        User.objects.create_user(username='existing.user', email='taken@example.com', password='password')

        data = {
            'username': 'new.user',
            'email': 'taken@example.com',
            'password1': 'password',
            'password2': 'password',
            'preferred_name': 'New',
            'first_name': 'New',
            'last_name': 'User',
            'request_id': '123'
        }

        response = self.client.post(reverse('rest_name_register'), data, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('email', response.data)

    def test_duplicate_email_update(self):
        User.objects.create_user(username='other.user', email='taken@example.com', password='password')

        self.client.force_authenticate(user=self.user)
        response = self.client.patch(f'/members/{self.member.id}/', {'email': 'taken@example.com'}, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('email', response.data)
        self.client.force_authenticate(user=None)

    def test_member_update_own_details(self):
        self.client.force_authenticate(user=self.user)

        # Try to update allowed and read-only fields
        data = {
            'phone': '555-1234',
            'public_bio': 'Hello world',
            'is_director': True,
            'monthly_fees': 50,
            'precix_cnc_cert_date': '2023-01-01'
        }

        response = self.client.patch(f'/members/{self.member.id}/', data, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        self.member.refresh_from_db()
        # Allowed fields should be updated
        self.assertEqual(self.member.phone, '555-1234')
        self.assertEqual(self.member.public_bio, 'Hello world')

        # Read-only fields should NOT be updated
        self.assertFalse(self.member.is_director)
        self.assertNotEqual(self.member.monthly_fees, 50)
        self.assertIsNone(self.member.precix_cnc_cert_date)

        self.client.force_authenticate(user=None)

    @patch('apiserver.api.utils_ldap.add_to_group')
    @patch('apiserver.api.utils_ldap.remove_from_group')
    def test_admin_update_member_details(self, mock_remove, mock_add):
        admin_user = User.objects.create_user(username='admin.user', email='admin@example.com', password='password')
        admin_member = models.Member.objects.create(user=admin_user, preferred_name='Admin', last_name='User', is_staff=True)

        self.client.force_authenticate(user=admin_user)

        # Update admin-only fields on the regular member
        data = {
            'monthly_fees': 50,
            'precix_cnc_cert_date': '2023-01-01',
            'is_allowed_entry': False
        }

        with patch('apiserver.api.utils_stats.changed_card') as mock_changed_card:
            response = self.client.patch(f'/members/{self.member.id}/', data, format='json')
            self.assertEqual(response.status_code, status.HTTP_200_OK)

            self.member.refresh_from_db()
            self.assertEqual(self.member.monthly_fees, 50)
            self.assertEqual(str(self.member.precix_cnc_cert_date), '2023-01-01')
            self.assertFalse(self.member.is_allowed_entry)

            # Verify side effects
            mock_add.assert_called_with(self.member, 'CNC-Precix-Users')
            self.assertTrue(mock_changed_card.called)

        # Test removing cert
        data = {
            'precix_cnc_cert_date': None
        }
        response = self.client.patch(f'/members/{self.member.id}/', data, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        self.member.refresh_from_db()
        self.assertIsNone(self.member.precix_cnc_cert_date)
        mock_remove.assert_called_with(self.member, 'CNC-Precix-Users')

        self.client.force_authenticate(user=None)


class AdditionalRouteTests(APITestCase):
    @classmethod
    def setUpTestData(cls):
        cls.user = User.objects.create_user(
            username='route.tester', email='route@example.com',
            password='oldpassword', is_staff=True,
        )
        cls.member = Member.objects.create(
            user=cls.user,
            first_name='Route',
            last_name='Tester',
            preferred_name='Route',
            status='Current',
            vetted_date=utils.today_local_tz(),
            orientation_date=utils.today_local_tz(),
        )
        cls.other_user = User.objects.create_user(
            username='route.other', email='other@example.com', password='password',
        )
        cls.other_member = Member.objects.create(
            user=cls.other_user,
            first_name='Other',
            last_name='Tester',
            preferred_name='Other',
            status='Current',
            vetted_date=utils.today_local_tz(),
        )

    def setUp(self):
        cache.clear()
        self.client.force_authenticate(user=self.user)

    def make_course_session(self, **session_fields):
        course = models.Course.objects.create(name='Route test course')
        fields = dict(
            course=course,
            instructor=self.other_user,
            datetime=timezone.now() + timedelta(days=2),
            cost=Decimal('10.00'),
        )
        fields.update(session_fields)
        return course, models.Session.objects.create(**fields)

    def test_card_door_and_lockout_validation_edges(self):
        missing_member = self.client.post('/cards/', {
            'card_number': 'missing-member-card',
            'active_status': 'card_active',
        }, format='json')
        self.assertEqual(missing_member.status_code, status.HTTP_400_BAD_REQUEST)

        invalid_status = self.client.post('/cards/', {
            'member_id': self.member.id,
            'card_number': 'invalid-status-card',
            'active_status': 'active',
        }, format='json')
        self.assertEqual(invalid_status.status_code, status.HTTP_400_BAD_REQUEST)

        unvetted_user = User.objects.create_user(username='route.unvetted')
        unvetted_member = Member.objects.create(
            user=unvetted_user, first_name='Unvetted', last_name='Member',
            preferred_name='Unvetted', status='Current',
        )
        unvetted_card = self.client.post('/cards/', {
            'member_id': unvetted_member.id,
            'card_number': 'unvetted-card',
            'active_status': 'card_active',
        }, format='json')
        self.assertEqual(unvetted_card.status_code, status.HTTP_400_BAD_REQUEST)

        valid_card = models.Card.objects.create(
            user=self.user, card_number='edge-card', active_status='card_active',
        )
        duplicate = self.client.post('/cards/', {
            'member_id': self.member.id,
            'card_number': valid_card.card_number,
            'active_status': 'card_active',
        }, format='json')
        self.assertEqual(duplicate.status_code, status.HTTP_400_BAD_REQUEST)

        with patch('apiserver.api.views.secrets.DOOR_API_TOKEN', 'door-token'):
            self.assertEqual(self.client.get('/door/').status_code, status.HTTP_403_FORBIDDEN)
            self.assertEqual(self.client.get('/lockout/').status_code, status.HTTP_403_FORBIDDEN)
            missing_scan = self.client.post(
                '/door/unknown-card/seen/',
                HTTP_AUTHORIZATION='Bearer door-token',
            )
        self.assertEqual(missing_scan.status_code, status.HTTP_404_NOT_FOUND)

        # A paused/non-vetted card may not be exposed to the door list, and a
        # member with entry disabled is omitted from both hardware responses.
        paused_user = User.objects.create_user(username='route.paused')
        paused_member = Member.objects.create(
            user=paused_user, first_name='Paused', last_name='Member',
            preferred_name='Paused', status='Paused Member',
            paused_date=utils.today_local_tz(), vetted_date=utils.today_local_tz(),
        )
        disallowed_user = User.objects.create_user(username='route.disallowed')
        disallowed_member = Member.objects.create(
            user=disallowed_user, first_name='Disallowed', last_name='Member',
            preferred_name='Disallowed', vetted_date=utils.today_local_tz(),
            is_allowed_entry=False,
        )
        models.Card.objects.create(user=paused_user, card_number='paused-card', active_status='card_active')
        models.Card.objects.create(user=unvetted_user, card_number='unvetted-door-card', active_status='card_active')
        models.Card.objects.create(user=disallowed_user, card_number='disallowed-card', active_status='card_active')
        headers = {'HTTP_AUTHORIZATION': 'Bearer {}'.format(secrets.DOOR_API_TOKEN)}
        door = self.client.get('/door/', **headers)
        lockout = self.client.get('/lockout/', **headers)
        self.assertNotIn('paused-card', door.data)
        self.assertNotIn('unvetted-door-card', door.data)
        self.assertNotIn('disallowed-card', door.data)
        self.assertNotIn('paused-card', lockout.data)
        self.assertNotIn('disallowed-card', lockout.data)

    def test_card_door_and_lockout_routes(self):
        response = self.client.post('/cards/', {
            'member_id': self.member.id,
            'card_number': 'route-card',
            'active_status': 'card_active',
            'notes': 'Route test card',
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        card_id = response.data['id']

        retrieved = self.client.get('/cards/{}/'.format(card_id))
        self.assertEqual(retrieved.status_code, status.HTTP_200_OK)
        self.assertEqual(retrieved.data['member_id'], self.member.id)
        updated = self.client.patch('/cards/{}/'.format(card_id), {
            'member_id': self.member.id,
            'active_status': 'card_inactive',
        }, format='json')
        self.assertEqual(updated.status_code, status.HTTP_200_OK)
        self.assertEqual(models.Card.objects.get(pk=card_id).active_status, 'card_inactive')

        card = models.Card.objects.get(pk=card_id)
        card.active_status = 'card_active'
        card.save()
        token_header = {'HTTP_AUTHORIZATION': 'Bearer {}'.format(secrets.DOOR_API_TOKEN)}
        door = self.client.get('/door/', **token_header)
        self.assertEqual(door.status_code, status.HTTP_200_OK)
        self.assertEqual(door.data[card.card_number], 'Route T ({})'.format(self.member.id))

        with patch('apiserver.api.views.utils.mqtt_publish') as mqtt_publish:
            seen = self.client.post('/door/{}/seen/'.format(card.card_number), **token_header)
        self.assertEqual(seen.status_code, status.HTTP_200_OK)
        card.refresh_from_db()
        self.assertIsNotNone(card.last_seen)
        self.assertEqual(cache.get('last_scan')['member_id'], self.member.id)
        mqtt_publish.assert_called_once()

        lockout = self.client.get('/lockout/', **token_header)
        self.assertEqual(lockout.status_code, status.HTTP_200_OK)
        self.assertEqual(lockout.data[card.card_number]['id'], self.member.id)
        self.assertTrue(lockout.data[card.card_number]['common'])

        bad_token = self.client.get('/door/', HTTP_AUTHORIZATION='Bearer wrong')
        self.assertEqual(bad_token.status_code, status.HTTP_403_FORBIDDEN)

    def test_todo_and_minecraft_error_paths(self):
        with patch('apiserver.api.views.utils_todo.get_task_list', side_effect=RuntimeError('todo unavailable')):
            task_error = self.client.get('/todo/tasks/?project=Consumables')
        self.assertEqual(task_error.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('todo unavailable', str(task_error.data))
        with patch('apiserver.api.views.utils_todo.add_task_or_bump', side_effect=RuntimeError('todo write failed')):
            add_error = self.client.post('/todo/out_of_stock/', {'item': 'soap'}, format='json')
        self.assertEqual(add_error.status_code, status.HTTP_400_BAD_REQUEST)

        for name in ('', '   ', 42):
            with self.subTest(name=name):
                invalid_name = self.client.post('/minecraft/whitelist/', {'name': name}, format='json')
                self.assertEqual(invalid_name.status_code, status.HTTP_400_BAD_REQUEST)

        with patch('apiserver.api.views.requests.post') as post:
            post.side_effect = requests.RequestException('network down')
            unavailable = self.client.post('/minecraft/whitelist/', {'name': 'Player'}, format='json')
        self.assertEqual(unavailable.status_code, status.HTTP_502_BAD_GATEWAY)

        with patch('apiserver.api.views.requests.post') as post:
            post.return_value.status_code = 200
            post.return_value.json.return_value = {'result': ''}
            already_listed = self.client.post('/minecraft/whitelist/', {'name': 'Player'}, format='json')
        self.assertEqual(already_listed.status_code, status.HTTP_400_BAD_REQUEST)

        with patch('apiserver.api.views.requests.post') as post:
            post.return_value.status_code = 200
            post.return_value.json.return_value = {'result': 'No player was found'}
            not_found = self.client.post('/minecraft/whitelist/', {'name': 'UnknownPlayer'}, format='json')
        self.assertEqual(not_found.status_code, status.HTTP_400_BAD_REQUEST)

        with patch('apiserver.api.views.requests.post') as post:
            post.return_value.status_code = 503
            post.return_value.json.return_value = {'error': 'server down'}
            server_error = self.client.post('/minecraft/whitelist/', {'name': 'Player'}, format='json')
        self.assertEqual(server_error.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('server down', str(server_error.data))

    def test_quiz_successful_certification_and_prerequisite_branches(self):
        sawstop_data = {
            'agree1': 'true', 'agree2': 'true', 'agree3': 'true',
            'material1': 'true', 'material2': 'false', 'material3': 'true',
            'material4': 'true', 'material5': 'true', 'material6': 'true',
            'material7': 'true', 'bypass1': 'false', 'bypass2': 'false',
            'bypass3': 'true', 'bypass4': 'true', 'bypass5': 'true',
            'tested1': 'true', 'tested2': 'false', 'tested3': 'false',
            'tested4': 'false', 'tested5': 'true', 'tested6': 'true',
            'never1': 'false', 'never2': 'true', 'never3': 'false',
            'never4': 'true', 'never5': 'true', 'never6': 'false',
            'led1': 'true', 'led2': 'false', 'led3': 'false',
            'spin1': 'false', 'spin2': 'true', 'spin3': 'false',
            'spin4': 'false', 'tape1': 'true', 'tape2': 'false',
        }
        sawstop_url = '/quiz/sawstop/submit/'
        no_wood_training = self.client.post(sawstop_url, sawstop_data, format='multipart')
        self.assertEqual(no_wood_training.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('Wood I', str(no_wood_training.data))

        wood_course = models.Course.objects.create(id=261, name='Wood I')
        wood_session = models.Session.objects.create(
            course=wood_course, datetime=timezone.now(), cost=0,
        )
        models.Training.objects.create(
            user=self.user, session=wood_session, attendance_status='Attended',
        )
        wrong_sawstop = dict(sawstop_data, tested1='false')
        self.assertEqual(
            self.client.post(sawstop_url, wrong_sawstop, format='multipart').status_code,
            status.HTTP_400_BAD_REQUEST,
        )
        granted = self.client.post(sawstop_url, sawstop_data, format='multipart')
        self.assertEqual(granted.status_code, status.HTTP_200_OK)
        self.member.refresh_from_db()
        self.assertEqual(self.member.wood_cert_date, utils.today_local_tz())
        duplicate = self.client.post(sawstop_url, sawstop_data, format='multipart')
        self.assertEqual(duplicate.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('Already certified', str(duplicate.data))

        scanner_data = {
            'agree1': 'true', 'value1': 'false', 'value2': 'false',
            'value3': 'true', 'value4': 'false', 'before1': 'false',
            'before2': 'true', 'before3': 'false', 'before4': 'false',
            'validate1': 'false', 'validate2': 'false', 'validate3': 'true',
            'validate4': 'false', 'items1': 'false', 'items2': 'false',
            'items3': 'true', 'items4': 'false', 'location1': 'true',
            'location2': 'false', 'location3': 'false', 'location4': 'false',
            'damage1': 'false', 'damage2': 'true', 'damage3': 'false',
            'compliance1': 'true', 'compliance2': 'false',
            'compliance3': 'false', 'compliance4': 'false',
            'return1': 'false', 'return2': 'false', 'return3': 'false',
            'return4': 'true', 'access1': 'false', 'access2': 'true',
            'access3': 'false', 'access4': 'false',
        }
        models.Training.objects.filter(
            user=self.user, session__course_id=249,
        ).delete()
        self.member.refresh_from_db()
        self.member.orientation_date = None
        self.member.save()
        self.client.force_authenticate(user=User.objects.get(pk=self.user.pk))
        self.assertFalse(models.Training.objects.filter(
            user=self.user, session__course_id=249,
        ).exists())
        no_orientation = self.client.post('/quiz/scanner/submit/', scanner_data, format='multipart')
        self.assertEqual(no_orientation.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('New Member Orientation', str(no_orientation.data))

        self.member.orientation_date = utils.today_local_tz()
        self.member.save()
        self.client.force_authenticate(user=User.objects.get(pk=self.user.pk))
        invalid_scanner = dict(scanner_data, value1='true')
        self.assertEqual(
            self.client.post('/quiz/scanner/submit/', invalid_scanner, format='multipart').status_code,
            status.HTTP_400_BAD_REQUEST,
        )
        scanner_granted = self.client.post('/quiz/scanner/submit/', scanner_data, format='multipart')
        self.assertEqual(scanner_granted.status_code, status.HTTP_200_OK)
        self.member.refresh_from_db()
        self.assertEqual(self.member.scanner_cert_date, utils.today_local_tz())
        already_scanner = self.client.post('/quiz/scanner/submit/', scanner_data, format='multipart')
        self.assertEqual(already_scanner.status_code, status.HTTP_400_BAD_REQUEST)

    def test_quiz_todo_and_minecraft_routes(self):
        unknown_quiz = self.client.post('/quiz/unknown/submit/', {}, format='json')
        self.assertEqual(unknown_quiz.status_code, status.HTTP_400_BAD_REQUEST)

        with patch('apiserver.api.views.utils_todo.get_task_list', return_value=[{'title': 'soap'}]) as get_tasks, \
             patch('apiserver.api.views.utils_todo.add_task_or_bump') as add_task:
            tasks = self.client.get('/todo/tasks/?project=Consumables')
            self.assertEqual(tasks.status_code, status.HTTP_200_OK)
            self.assertEqual(tasks.data, [{'title': 'soap'}])
            get_tasks.assert_called_once_with('Consumables')

            missing_project = self.client.get('/todo/tasks/')
            self.assertEqual(missing_project.status_code, status.HTTP_400_BAD_REQUEST)
            missing_item = self.client.post('/todo/out_of_stock/', {}, format='json')
            self.assertEqual(missing_item.status_code, status.HTTP_400_BAD_REQUEST)
            added = self.client.post('/todo/out_of_stock/', {'item': 'soap'}, format='json')
            self.assertEqual(added.status_code, status.HTTP_200_OK)
            add_task.assert_called_once_with('Consumables', 'soap')

        with patch('apiserver.api.views.requests.post') as post:
            post.return_value.status_code = 200
            post.return_value.json.return_value = {'result': 'added'}
            response = self.client.post('/minecraft/whitelist/', {'name': 'RoutePlayer'}, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data, {'result': 'added'})
        self.assertEqual(post.call_args[0][0], secrets.PROTOCRAFT_URL + '/whitelist')

        missing_name = self.client.post('/minecraft/whitelist/', {}, format='json')
        self.assertEqual(missing_name.status_code, status.HTTP_400_BAD_REQUEST)
        with patch('apiserver.api.views.secrets.PROTOCRAFT_URL', ''):
            unavailable = self.client.post('/minecraft/whitelist/', {'name': 'Player'}, format='json')
        self.assertEqual(unavailable.status_code, status.HTTP_503_SERVICE_UNAVAILABLE)

    def test_drawing_search_and_vetting_routes(self):
        drawing = models.Drawing.objects.create(owner=self.user, filename='existing.png')
        self.assertEqual(self.client.get('/drawing/').status_code, status.HTTP_200_OK)
        update = self.client.patch('/drawing/{}/'.format(drawing.id), {'is_hidden': True}, format='json')
        self.assertEqual(update.status_code, status.HTTP_200_OK)
        self.assertTrue(models.Drawing.objects.get(pk=drawing.id).is_hidden)

        missing_image = self.client.post('/drawing/', {}, format='json')
        self.assertEqual(missing_image.status_code, status.HTTP_400_BAD_REQUEST)
        with patch('apiserver.api.throttles.LoggingThrottle.allow_request', return_value=True):
            malformed = self.client.post('/drawing/', {'image': 'not-a-data-url'}, format='json')
            self.assertEqual(malformed.status_code, status.HTTP_400_BAD_REQUEST)

            jpeg = Image.new('RGB', (2, 2), (1, 2, 3))
            jpeg_stream = io.BytesIO()
            jpeg.save(jpeg_stream, format='JPEG')
            jpeg_data = 'data:image/jpeg;base64,' + base64.b64encode(jpeg_stream.getvalue()).decode('ascii')
            wrong_format = self.client.post('/drawing/', {'image': jpeg_data}, format='json')
            self.assertEqual(wrong_format.status_code, status.HTTP_400_BAD_REQUEST)

            invalid_header_image = Image.new('RGBA', (8, 1), (1, 2, 3, 0))
            invalid_header_stream = io.BytesIO()
            invalid_header_image.save(invalid_header_stream, format='PNG')
            invalid_header_data = 'data:image/png;base64,' + base64.b64encode(invalid_header_stream.getvalue()).decode('ascii')
            invalid_header = self.client.post('/drawing/', {'image': invalid_header_data}, format='json')
            self.assertEqual(invalid_header.status_code, status.HTTP_400_BAD_REQUEST)

        png_header = base64.b64decode('UF9TX0RfQw==').decode('utf-8')
        image = Image.new('RGBA', (len(png_header) + 1, 1), (1, 2, 3, 0))
        for index, char in enumerate(png_header):
            image.putpixel((index, 0), (1, 2, 3, ord(char)))
        image_stream = io.BytesIO()
        image.save(image_stream, format='PNG')
        encoded_image = 'data:image/png;base64,' + base64.b64encode(image_stream.getvalue()).decode('ascii')
        with patch('apiserver.api.throttles.LoggingThrottle.allow_request', return_value=True), \
             patch('apiserver.api.views.Image.Image.save'), \
             patch('apiserver.api.views.utils.mqtt_publish') as mqtt_publish:
            created = self.client.post('/drawing/', {'image': encoded_image}, format='json')
        self.assertEqual(created.status_code, status.HTTP_201_CREATED)
        self.assertTrue(created.data['filename'].startswith('drawing'))
        mqtt_publish.assert_called_once()

        cache.set('search_strings', {'route tester': self.member.id})
        search = self.client.post('/search/', {'q': 'route'}, format='json')
        self.assertEqual(search.status_code, status.HTTP_200_OK)
        self.assertGreaterEqual(search.data['total'], 1)
        retrieved = self.client.get('/search/{}/'.format(self.member.id))
        self.assertEqual(retrieved.status_code, status.HTTP_200_OK)

        eligible = Member.objects.create(
            first_name='Needs', last_name='Vetting', preferred_name='Needs',
            status='Current', current_start_date=utils.today_local_tz() - timedelta(days=40),
            orientation_date=utils.today_local_tz(),
        )
        vetting = self.client.get('/vetting/')
        self.assertEqual(vetting.status_code, status.HTTP_200_OK)
        self.assertIn(eligible.id, [item['id'] for item in vetting.data['results']])

    def test_pinball_routes(self):
        card = models.Card.objects.create(
            user=self.user, card_number='pinball-route-card', active_status='card_active',
        )
        score_response = self.client.post('/pinball/score/', {
            'card_number': card.card_number,
            'game_id': 123,
            'player': 1,
            'score': 12340,
        }, format='json')
        self.assertEqual(score_response.status_code, status.HTTP_200_OK)
        score = models.PinballScore.objects.get(game_id=123, player=1)
        self.assertEqual(score.user, self.user)

        invalid_score = self.client.post('/pinball/score/', {
            'game_id': 123, 'player': 2, 'score': 12345,
        }, format='json')
        self.assertEqual(invalid_score.status_code, status.HTTP_400_BAD_REQUEST)
        missing_score = self.client.post('/pinball/score/', {'game_id': 'bad'}, format='json')
        self.assertEqual(missing_score.status_code, status.HTTP_400_BAD_REQUEST)
        bad_card = self.client.post('/pinball/score/', {
            'card_number': 'no-such-card', 'game_id': 123,
            'player': 4, 'score': 100,
        }, format='json')
        self.assertEqual(bad_card.status_code, status.HTTP_404_NOT_FOUND)

        # High-score queries only include imported/established game records.
        score.id = 6720
        score.finished_at = timezone.now()
        score.save()
        high_scores = self.client.get('/pinball/high_scores/')
        self.assertEqual(high_scores.status_code, status.HTTP_200_OK)
        self.assertEqual(high_scores.data[0]['member_id'], self.member.id)
        monthly = self.client.get('/pinball/monthly_high_scores/')
        self.assertEqual(monthly.status_code, status.HTTP_200_OK)
        self.assertTrue(monthly.data)

        name = self.client.get('/pinball/{}/get_name/'.format(card.card_number))
        self.assertEqual(name.status_code, status.HTTP_200_OK)
        self.assertEqual(name.data['drink'], 'can of Pop')
        self.member.allow_last_scanned = False
        self.member.save()
        private_name = self.client.get('/pinball/{}/get_name/'.format(card.card_number))
        self.assertEqual(private_name.status_code, status.HTTP_200_OK)
        self.assertEqual(private_name.data['drink'], 'Slug-O-Cola')
        with patch('apiserver.api.views.secrets.PINBALL_API_TOKEN', 'pinball-token'):
            forbidden = self.client.post('/pinball/score/', {
                'game_id': 123, 'player': 3, 'score': 100,
            }, HTTP_AUTHORIZATION='Bearer wrong', format='json')
        self.assertEqual(forbidden.status_code, status.HTTP_403_FORBIDDEN)

    def test_hosting_and_signuphelper_routes(self):
        with patch('apiserver.api.views.utils.spaceporter_host') as notify:
            offered = self.client.post('/hosting/offer/', {
                'member_id': self.member.id,
                'hours': 3,
            }, format='json')
        self.assertEqual(offered.status_code, status.HTTP_200_OK)
        hosting = models.Hosting.objects.get(user=self.user)
        self.assertEqual(hosting.hours, Decimal('3.00'))
        self.assertIsNotNone(cache.get('closing'))
        notify.assert_called_once()

        # A second offer extends the existing active hosting rather than making
        # another row.
        extended = self.client.post('/hosting/offer/', {
            'member_id': self.member.id, 'hours': 5,
        }, format='json')
        self.assertEqual(extended.status_code, status.HTTP_200_OK)
        self.assertEqual(models.Hosting.objects.filter(user=self.user).count(), 1)
        self.assertEqual(self.client.get('/hosting/high_scores/').status_code, status.HTTP_200_OK)
        self.assertEqual(self.client.get('/hosting/monthly_high_scores/').status_code, status.HTTP_200_OK)

        signup = Member.objects.create(
            user=User.objects.create_user(username='referred.member'),
            signup_helper=self.user,
            first_name='Referred', last_name='Member', preferred_name='Referred',
            status='Current',
        )
        helpers = self.client.get('/signuphelper/high_scores/')
        self.assertEqual(helpers.status_code, status.HTTP_200_OK)
        self.assertIn(self.member.id, [row['member_id'] for row in helpers.data])
        self.assertIsNotNone(signup.id)

    def test_storage_routes(self):
        shelf = models.StorageSpace.objects.create(shelf_id='ROUTE-SHELF', classification='SHELF')
        self.assertEqual(self.client.get('/storage/available/').status_code, status.HTTP_200_OK)
        claimed = self.client.post('/storage/claim/', {'shelf_id': 'route-shelf'}, format='json')
        self.assertEqual(claimed.status_code, status.HTTP_200_OK)
        shelf.refresh_from_db()
        self.assertEqual(shelf.user, self.user)

        listing = self.client.get('/storage/')
        self.assertEqual(listing.status_code, status.HTTP_200_OK)
        detail = self.client.get('/storage/{}/'.format(shelf.id))
        self.assertEqual(detail.status_code, status.HTTP_200_OK)
        update = self.client.patch('/storage/{}/'.format(shelf.id), {
            'member_id': self.other_member.id,
            'memo': 'updated by admin',
        }, format='json')
        self.assertEqual(update.status_code, status.HTTP_200_OK)
        shelf.refresh_from_db()
        self.assertEqual(shelf.user, self.other_user)
        released = self.client.post('/storage/release/', {'shelf_id': 'route-shelf'}, format='json')
        self.assertEqual(released.status_code, status.HTTP_400_BAD_REQUEST)
        self.client.force_authenticate(user=self.other_user)
        released = self.client.post('/storage/release/', {'shelf_id': 'route-shelf'}, format='json')
        self.assertEqual(released.status_code, status.HTTP_200_OK)
        shelf.refresh_from_db()
        self.assertIsNone(shelf.user)

    def test_storage_claim_and_release_edge_cases(self):
        missing_id = self.client.post('/storage/claim/', {}, format='json')
        self.assertEqual(missing_id.status_code, status.HTTP_400_BAD_REQUEST)
        unknown_shelf = self.client.post('/storage/claim/', {'shelf_id': 'missing'}, format='json')
        self.assertEqual(unknown_shelf.status_code, status.HTTP_400_BAD_REQUEST)

        locked = models.StorageSpace.objects.create(shelf_id='LOCKED-SHELF', classification='LOCKER')
        not_regular = self.client.post('/storage/claim/', {'shelf_id': locked.shelf_id}, format='json')
        self.assertEqual(not_regular.status_code, status.HTTP_400_BAD_REQUEST)

        for shelf_id in ('FIRST-SHELF', 'SECOND-SHELF', 'THIRD-SHELF'):
            models.StorageSpace.objects.create(shelf_id=shelf_id, classification='SHELF')
        for shelf_id in ('FIRST-SHELF', 'SECOND-SHELF'):
            response = self.client.post('/storage/claim/', {'shelf_id': shelf_id}, format='json')
            self.assertEqual(response.status_code, status.HTTP_200_OK)
        too_many = self.client.post('/storage/claim/', {'shelf_id': 'THIRD-SHELF'}, format='json')
        self.assertEqual(too_many.status_code, status.HTTP_400_BAD_REQUEST)

        self.assertEqual(self.client.post('/storage/release/', {}, format='json').status_code, status.HTTP_400_BAD_REQUEST)
        unowned = self.client.post('/storage/release/', {'shelf_id': 'THIRD-SHELF'}, format='json')
        self.assertEqual(unowned.status_code, status.HTTP_400_BAD_REQUEST)

        unvetted_user = User.objects.create_user(username='storage.unvetted')
        Member.objects.create(
            user=unvetted_user, first_name='Storage', last_name='Unvetted',
            preferred_name='Unvetted', status='Current',
        )
        self.client.force_authenticate(user=unvetted_user)
        unvetted_shelf = self.client.post('/storage/claim/', {'shelf_id': 'THIRD-SHELF'}, format='json')
        self.assertEqual(unvetted_shelf.status_code, status.HTTP_400_BAD_REQUEST)

        overdue_user = User.objects.create_user(username='storage.overdue')
        Member.objects.create(
            user=overdue_user, first_name='Storage', last_name='Overdue',
            preferred_name='Overdue', status='Overdue', vetted_date=utils.today_local_tz(),
        )
        self.client.force_authenticate(user=overdue_user)
        overdue_claim = self.client.post('/storage/claim/', {'shelf_id': 'THIRD-SHELF'}, format='json')
        self.assertEqual(overdue_claim.status_code, status.HTTP_400_BAD_REQUEST)

    def test_training_and_interest_validation_edges(self):
        course, full_session = self.make_course_session(max_students=1)
        models.Training.objects.create(
            user=self.other_user, session=full_session, attendance_status='Confirmed',
        )
        full = self.client.post('/training/', {
            'session': full_session.id, 'attendance_status': 'Waiting for payment',
        }, format='json')
        self.assertEqual(full.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('Class is full', str(full.data))

        _course, open_session = self.make_course_session(max_students=None)
        first = self.client.post('/training/', {
            'session': open_session.id, 'attendance_status': 'Confirmed',
        }, format='json')
        self.assertEqual(first.status_code, status.HTTP_201_CREATED)
        duplicate = self.client.post('/training/', {
            'session': open_session.id, 'attendance_status': 'Confirmed',
        }, format='json')
        self.assertEqual(duplicate.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('Already registered', str(duplicate.data))

        unpaid = models.Training.objects.create(
            user=self.other_user, session=open_session, attendance_status='Confirmed',
        )
        unpaid_refund = self.client.post('/training/{}/refund/'.format(unpaid.id), {}, format='json')
        self.assertEqual(unpaid_refund.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('not been paid', str(unpaid_refund.data))

        with patch('apiserver.api.views.utils_stats.calc_num_interested'):
            created = self.client.post('/interest/', {'course': course.id}, format='json')
            self.assertEqual(created.status_code, status.HTTP_201_CREATED)
            duplicate_interest = self.client.post('/interest/', {'course': course.id}, format='json')
        self.assertEqual(duplicate_interest.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('Already interested', str(duplicate_interest.data))

    def test_training_and_interest_routes(self):
        course, session = self.make_course_session()
        created = self.client.post('/training/', {
            'session': session.id,
            'attendance_status': 'Confirmed',
        }, format='json')
        self.assertEqual(created.status_code, status.HTTP_201_CREATED)
        training_id = created.data['id']
        detail = self.client.get('/training/{}/'.format(training_id))
        self.assertEqual(detail.status_code, status.HTTP_200_OK)

        updated = self.client.patch('/training/{}/'.format(training_id), {
            'session': session.id,
            'attendance_status': 'Attended',
        }, format='json')
        self.assertEqual(updated.status_code, status.HTTP_200_OK)
        training = models.Training.objects.get(pk=training_id)
        self.assertEqual(training.attendance_status, 'Attended')

        paid_training = models.Training.objects.create(
            user=self.other_user, session=session, attendance_status='Confirmed',
            paid_date=utils.today_local_tz(),
        )
        with patch('apiserver.api.views.utils.log_transaction') as log_transaction:
            refund = self.client.post('/training/{}/refund/'.format(paid_training.id), {}, format='json')
        self.assertEqual(refund.status_code, status.HTTP_200_OK)
        paid_training.refresh_from_db()
        self.assertEqual(paid_training.attendance_status, 'Withdrawn')
        self.assertIsNone(paid_training.paid_date)
        log_transaction.assert_called_once()

        with patch('apiserver.api.views.utils_stats.calc_num_interested') as recount:
            interest_response = self.client.post('/interest/', {'course': course.id}, format='json')
        self.assertEqual(interest_response.status_code, status.HTTP_201_CREATED)
        interest_id = interest_response.data['id']
        self.assertEqual(self.client.get('/interest/{}/'.format(interest_id)).status_code, status.HTTP_200_OK)
        recount.assert_called_once()

    def test_tools_routes(self):
        categories = self.client.get('/tools/categories/')
        self.assertEqual(categories.status_code, status.HTTP_200_OK)
        self.assertEqual(len(categories.data), 10)
        with patch('apiserver.api.views.utils_mediawiki.create_tool_page', return_value='https://wiki.example/tool') as create_page:
            created = self.client.post('/tools/', {'name': 'A tool'}, format='json')
        self.assertEqual(created.status_code, status.HTTP_201_CREATED)
        self.assertEqual(created.data['toolUrl'], 'https://wiki.example/tool')
        create_page.assert_called_once_with({'name': 'A tool'}, username=self.user.username)

        with patch('apiserver.api.views.utils_mediawiki.create_tool_page', side_effect=RuntimeError('wiki unavailable')):
            failed = self.client.post('/tools/', {'name': 'Broken tool'}, format='json')
        self.assertEqual(failed.status_code, status.HTTP_400_BAD_REQUEST)
        self.client.force_authenticate(user=None)
        unauthorized = self.client.post('/tools/', {'name': 'Anonymous tool'}, format='json')
        self.assertEqual(unauthorized.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_chart_routes(self):
        today = utils.today_local_tz()
        models.StatsMemberCount.objects.create(
            date=today, member_count=10, green_count=8,
            six_month_plus_count=5, vetted_count=4, subscriber_count=2,
        )
        models.StatsSignupCount.objects.create(month=today.replace(day=1), signup_count=3)
        models.StatsSpaceActivity.objects.create(date=today, card_scans=7)
        member_counts = self.client.get('/charts/membercount/')
        signup_counts = self.client.get('/charts/signupcount/')
        activity = self.client.get('/charts/spaceactivity/')
        self.assertEqual(member_counts.status_code, status.HTTP_200_OK)
        self.assertEqual(signup_counts.status_code, status.HTTP_200_OK)
        self.assertEqual(activity.status_code, status.HTTP_200_OK)
        self.assertEqual(member_counts.data[0]['member_count'], 10)
        self.assertEqual(signup_counts.data[0]['signup_count'], 3)
        self.assertEqual(activity.data[0]['card_scans'], 7)

    def test_stats_and_history_collection_routes(self):
        cache.set('member_count', 23)
        stats = self.client.get('/stats/')
        self.assertEqual(stats.status_code, status.HTTP_200_OK)
        self.assertEqual(stats.data['member_count'], 23)
        extras = self.client.get('/stats/extras/')
        self.assertEqual(extras.status_code, status.HTTP_200_OK)
        cache.set('request-progress-route-test', ['working'])
        progress = self.client.get('/stats/progress/?request_id=route-test')
        self.assertEqual(progress.status_code, status.HTTP_200_OK)
        self.assertEqual(progress.data, ['working'])
        missing_progress_id = self.client.get('/stats/progress/')
        self.assertEqual(missing_progress_id.status_code, status.HTTP_400_BAD_REQUEST)

        history_entry = models.HistoryIndex.objects.filter(object_name='Member').first()
        self.assertIsNotNone(history_entry)
        history = self.client.get('/history/')
        self.assertEqual(history.status_code, status.HTTP_200_OK)
        detail = self.client.get('/history/{}/'.format(history_entry.id))
        self.assertEqual(detail.status_code, status.HTTP_200_OK)
        self.client.force_authenticate(user=self.other_user)
        forbidden = self.client.get('/history/')
        self.assertEqual(forbidden.status_code, status.HTTP_403_FORBIDDEN)

    def test_member_actions_and_transaction_summary_routes(self):
        with patch('apiserver.api.views.utils.alert_tanner') as alert:
            paused = self.client.post('/members/{}/pause/'.format(self.other_member.id), {}, format='json')
        self.assertEqual(paused.status_code, status.HTTP_200_OK)
        self.other_member.refresh_from_db()
        self.assertIsNotNone(self.other_member.paused_date)
        alert.assert_called_once()

        with patch('apiserver.api.views.utils.gen_member_forms'), \
             patch('apiserver.api.views.utils_stats.changed_card'):
            unpaused = self.client.post('/members/{}/unpause/'.format(self.other_member.id), {}, format='json')
        self.assertEqual(unpaused.status_code, status.HTTP_200_OK)
        self.other_member.refresh_from_db()
        self.assertIsNone(self.other_member.paused_date)

        vetted = self.client.post('/members/{}/vet/'.format(self.other_member.id), {}, format='json')
        self.assertEqual(vetted.status_code, status.HTTP_200_OK)
        self.other_member.refresh_from_db()
        self.assertIsNotNone(self.other_member.vetted_date)

        self.other_member.photo_large = 'portrait.jpg'
        self.other_member.save()
        with patch('apiserver.api.views.utils.gen_card_photo', return_value=io.BytesIO(b'photo')):
            photo = self.client.get('/members/{}/card_photo/'.format(self.other_member.id))
        self.assertEqual(photo.status_code, status.HTTP_200_OK)
        self.assertEqual(photo['Content-Disposition'], 'inline; filename="card.jpg"')

        transaction = models.Transaction.objects.create(
            user=self.user, amount=Decimal('5.00'), category='Donation',
            date=utils.today_local_tz(),
        )
        month = utils.today_local_tz().strftime('%Y-%m')
        summary = self.client.get('/transactions/summary/?month=' + month)
        self.assertEqual(summary.status_code, status.HTTP_200_OK)
        self.assertTrue(any(row['category'] == 'Donation' and row['dollar'] == 5 for row in summary.data))

    def test_vetting_action_auto_grants_training_certifications(self):
        course_group_pairs = [
            (428, 'CNC-Precix-Users'),
            (247, 'Laser Users'),
            (321, 'Trotec Users'),
            (519, 'MOPA Users'),
            (520, 'Eufymake Users'),
        ]
        for course_id, _group in course_group_pairs:
            course = models.Course.objects.create(id=course_id, name='Certification {}'.format(course_id))
            session = models.Session.objects.create(
                course=course,
                datetime=timezone.now() + timedelta(days=1),
                cost=0,
            )
            models.Training.objects.create(
                user=self.other_user,
                session=session,
                attendance_status='Attended',
            )

        with patch('apiserver.api.views.utils_ldap.is_configured', return_value=True), \
             patch('apiserver.api.views.utils_ldap.add_to_group') as add_to_group:
            response = self.client.post(
                '/members/{}/vet/'.format(self.other_member.id), {}, format='json',
            )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.other_member.refresh_from_db()
        for field in (
            'precix_cnc_cert_date', 'rabbit_cert_date', 'trotec_cert_date',
            'mopa_cert_date', 'eufymakeuv_cert_date',
        ):
            with self.subTest(certification=field):
                self.assertEqual(getattr(self.other_member, field), utils.today_local_tz())
        self.assertEqual(
            {args[1] for args, _kwargs in add_to_group.call_args_list},
            {group for _course_id, group in course_group_pairs},
        )

    def test_session_ical_and_all_routes(self):
        _course, session = self.make_course_session()
        all_sessions = self.client.get('/sessions/all/')
        self.assertEqual(all_sessions.status_code, status.HTTP_200_OK)
        self.assertGreaterEqual(all_sessions.data['count'], 1)
        calendar = self.client.get('/sessions/{}/download_ical/'.format(session.id))
        self.assertEqual(calendar.status_code, status.HTTP_200_OK)
        self.assertEqual(calendar['Content-Type'], 'text/calendar')
        with patch('apiserver.api.views.utils_email.send_ical_email') as send_ical:
            emailed = self.client.post('/sessions/{}/email_ical/'.format(session.id), {}, format='json')
        self.assertEqual(emailed.status_code, status.HTTP_200_OK)
        send_ical.assert_called_once()

    def test_protocoin_printer_and_balance_routes(self):
        card = models.Card.objects.create(user=self.user, card_number='vend-balance-card')
        models.Transaction.objects.create(
            user=self.user, amount=0, protocoin=Decimal('20.00'),
            category='Other', account_type='Protocoin',
        )
        balance = self.client.get('/protocoin/{}/card_vend_balance/'.format(card.card_number))
        self.assertEqual(balance.status_code, status.HTTP_200_OK)
        self.assertEqual(balance.data['balance'], 20.0)

        self.assertEqual(self.client.get('/protocoin/printer_balance/').status_code, status.HTTP_200_OK)
        cache.set('track', {'ARTEMUS': {'username': self.user.username, 'time': timezone.now().timestamp()}})
        printer_balance = self.client.get('/protocoin/printer_balance/')
        self.assertEqual(printer_balance.status_code, status.HTTP_200_OK)
        self.assertEqual(printer_balance.data['balance'], 20.0)
        transactions = self.client.get('/protocoin/transactions/')
        self.assertEqual(transactions.status_code, status.HTTP_200_OK)
        self.assertEqual(transactions.data['total_protocoin'], 20.0)

        with patch('apiserver.api.views.utils.log_transaction') as log_transaction:
            report = self.client.post('/protocoin/printer_report/', {
                'uuid': 'printer-job-uuid',
                'user_name': self.user.username,
                'job_status': '0',
                'source': '1',
                'ink_ul': '100',
                'paper_name': 'Plain Paper',
                'paper_sqi': '1550',
                'job_name': 'Test poster',
            }, HTTP_AUTHORIZATION='Bearer {}'.format(secrets.PRINTER_API_TOKEN), format='json')
        self.assertEqual(report.status_code, status.HTTP_200_OK)
        self.assertTrue(models.Transaction.objects.filter(reference_number='printer-job-uuid').exists())
        log_transaction.assert_called_once()

        with patch('apiserver.api.views.utils.log_transaction') as log_transaction:
            cups_report = self.client.post('/protocoin/cups_printer_report/', {
                'job_id': 'cups-job-1',
                'user': self.user.username,
                'printer': 'OfficePrinter',
                'copies': '2',
                'title': 'Test document',
            }, HTTP_AUTHORIZATION='Bearer {}'.format(secrets.PRINTER_API_TOKEN), format='json')
        self.assertEqual(cups_report.status_code, status.HTTP_200_OK)
        self.assertTrue(models.Transaction.objects.filter(reference_number='cups-OfficePrinter-cups-job-1').exists())
        log_transaction.assert_called_once()

    def test_printer_report_alerts_on_unknown_paper_name(self):
        job_uuid = 'unknown-paper-job'
        headers = {'HTTP_AUTHORIZATION': 'Bearer {}'.format(secrets.PRINTER_API_TOKEN)}
        with patch('apiserver.api.views.utils.alert_tanner') as alert, \
             patch('apiserver.api.views.utils.log_transaction') as log_transaction:
            response = self.client.post('/protocoin/printer_report/', {
                'uuid': job_uuid,
                'user_name': self.user.username,
                'job_status': '0',
                'source': '1',
                'ink_ul': '10',
                'paper_name': 'Unknown Paper Type',
                'paper_sqi': '1550',
            }, format='json', **headers)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        alert.assert_called_once()
        self.assertIn(job_uuid, alert.call_args[0][0])
        self.assertIn('Unknown Paper Type', alert.call_args[0][0])
        self.assertTrue(models.Transaction.objects.filter(reference_number=job_uuid).exists())
        log_transaction.assert_called_once()

    def test_printer_reports_skip_duplicate_incomplete_and_missing_jobs(self):
        headers = {'HTTP_AUTHORIZATION': 'Bearer {}'.format(secrets.PRINTER_API_TOKEN)}
        report_fields = {
            'user_name': self.user.username,
            'job_status': '0',
            'source': '1',
            'ink_ul': '10',
            'paper_name': 'Plain Paper',
            'paper_sqi': '10',
            'job_name': 'Edge case print',
        }
        with patch('apiserver.api.views.utils.alert_tanner') as alert, \
             patch('apiserver.api.views.utils.log_transaction') as log_transaction:
            blank_uuid = dict(report_fields, uuid='')
            blank_response = self.client.post(
                '/protocoin/printer_report/', blank_uuid, format='json', **headers,
            )
            self.assertEqual(blank_response.status_code, status.HTTP_200_OK)
            alert.assert_called_once()
            log_transaction.assert_not_called()

            cancelled = dict(report_fields, uuid='cancelled-job', job_status='3')
            cancelled_response = self.client.post(
                '/protocoin/printer_report/', cancelled, format='json', **headers,
            )
            self.assertEqual(cancelled_response.status_code, status.HTTP_200_OK)
            non_print = dict(report_fields, uuid='not-a-print', source='2')
            non_print_response = self.client.post(
                '/protocoin/printer_report/', non_print, format='json', **headers,
            )
            self.assertEqual(non_print_response.status_code, status.HTTP_200_OK)

            models.Transaction.objects.create(
                reference_number='already-billed-job', user=self.user,
                amount=0, protocoin=-1, category='Consumables',
            )
            duplicate = dict(report_fields, uuid='already-billed-job')
            duplicate_response = self.client.post(
                '/protocoin/printer_report/', duplicate, format='json', **headers,
            )
            self.assertEqual(duplicate_response.status_code, status.HTTP_200_OK)
            log_transaction.assert_not_called()

        # Empty usernames are recovered from a recent ARTEMUS track record.
        cache.set('track', {
            'ARTEMUS': {
                'username': self.user.username,
                'time': timezone.now().timestamp(),
            },
        })
        fallback = dict(report_fields, uuid='track-fallback-job', user_name='')
        with patch('apiserver.api.views.utils.log_transaction') as log_transaction:
            fallback_response = self.client.post(
                '/protocoin/printer_report/', fallback, format='json', **headers,
            )
        self.assertEqual(fallback_response.status_code, status.HTTP_200_OK)
        self.assertTrue(models.Transaction.objects.filter(reference_number='track-fallback-job').exists())
        log_transaction.assert_called_once()

        cups_url = '/protocoin/cups_printer_report/'
        with patch('apiserver.api.views.utils.alert_tanner'):
            missing_job_id = self.client.post(cups_url, {'user': self.user.username}, format='json', **headers)
            self.assertEqual(missing_job_id.status_code, status.HTTP_400_BAD_REQUEST)
            missing_user = self.client.post(cups_url, {'job_id': 'missing-user'}, format='json', **headers)
            self.assertEqual(missing_user.status_code, status.HTTP_400_BAD_REQUEST)
            unknown_user = self.client.post(cups_url, {
                'job_id': 'unknown-user', 'user': 'no.such.user',
            }, format='json', **headers)
            self.assertEqual(unknown_user.status_code, status.HTTP_400_BAD_REQUEST)

        models.Transaction.objects.create(
            reference_number='cups-OfficePrinter-duplicate-cups',
            user=self.user, amount=0, protocoin=-1,
        )
        with patch('apiserver.api.views.utils.alert_tanner'):
            duplicate_cups = self.client.post(cups_url, {
                'job_id': 'duplicate-cups', 'user': self.user.username,
                'printer': 'OfficePrinter',
            }, format='json', **headers)
        self.assertEqual(duplicate_cups.status_code, status.HTTP_400_BAD_REQUEST)

        # Invalid copy counts default to one copy and still create a charge.
        with patch('apiserver.api.views.utils.log_transaction') as log_transaction:
            invalid_copies = self.client.post(cups_url, {
                'job_id': 'invalid-copies', 'user': self.user.username,
                'printer': 'OfficePrinter', 'copies': 'not-an-int',
            }, format='json', **headers)
        self.assertEqual(invalid_copies.status_code, status.HTTP_200_OK)
        self.assertTrue(models.Transaction.objects.filter(
            reference_number='cups-OfficePrinter-invalid-copies',
            protocoin=Decimal('-3.00'),
        ).exists())
        log_transaction.assert_called_once()

    def test_stats_write_and_device_routes(self):
        sign = self.client.post('/stats/sign/', {'sign': 'Hello…'}, format='json')
        self.assertEqual(sign.status_code, status.HTTP_200_OK)
        self.assertEqual(cache.get('sign'), 'Hello...')
        self.assertEqual(cache.get('vestaboard'), 'Hello...')
        link = self.client.post('/stats/sign/', {'sign': 'https://example.test'}, format='json')
        self.assertEqual(link.status_code, status.HTTP_200_OK)
        self.assertEqual(cache.get('link'), 'https://example.test')
        self.assertEqual(self.client.post('/stats/vestaboard/', {'vestaboard': 'Hello'}, format='json').status_code, status.HTTP_200_OK)

        alarm = self.client.post('/stats/alarm/', {'data': 'Armed away: Partition 1'}, format='json')
        self.assertEqual(alarm.status_code, status.HTTP_200_OK)
        self.assertEqual(cache.get('alarm')['data'], 'Armed')
        self.client.post('/stats/alarm/', {'data': 'Alarm: Partition 2'}, format='json')
        self.assertEqual(cache.get('alarm')['data'], 'Armed')
        for message, expected in (
            ('Disarmed: Partition 1', 'Disarmed'),
            ('Exit delay in progress: Partition 1', 'Exit delay'),
            ('Alarm: Partition 1', 'TRIGGERED!'),
        ):
            response = self.client.post('/stats/alarm/', {'data': message}, format='json')
            self.assertEqual(response.status_code, status.HTTP_200_OK)
            self.assertEqual(cache.get('alarm')['data'], expected)
        self.client.post('/stats/alarm/', {'data': 'Connected'}, format='json')
        self.assertEqual(cache.get('alarm')['data'], 'TRIGGERED!')

        tracked = self.client.post('/stats/track/', {
            'name': 'ARTEMUS', 'username': 'route.tester',
        }, format='json')
        self.assertEqual(tracked.status_code, status.HTTP_200_OK)
        self.assertEqual(cache.get('track')['ARTEMUS']['first_name'], 'Route')
        self.assertEqual(self.client.post('/stats/autoscan/', {'autoscan': 'ready'}, format='json').status_code, status.HTTP_200_OK)
        self.assertEqual(cache.get('autoscan'), 'ready')

        with patch('apiserver.api.views.utils.process_garden_image', return_value=('medium.jpg', 'large.jpg')) as process_photo:
            garden = self.client.post('/stats/garden/', {'photo': 'image-data'}, format='json')
        self.assertEqual(garden.status_code, status.HTTP_200_OK)
        process_photo.assert_called_once_with('image-data')

        printer = self.client.post('/stats/ord2/printer3d/', {
            'result': {'status': {
                'display_status': {'progress': 0.42},
                'idle_timeout': {'state': 'Printing'},
            }},
        }, format='json')
        self.assertEqual(printer.status_code, status.HTTP_200_OK)
        self.assertEqual(cache.get('printer3d')['ord2'], {'progress': 42, 'state': 'Printing'})
        p1s_payload = {'state': 'printing', 'progress': 55}
        p1s = self.client.post('/stats/p1s1/printer3d/', p1s_payload, format='json')
        self.assertEqual(p1s.status_code, status.HTTP_200_OK)
        self.assertEqual(cache.get('printer3d')['p1s1'], p1s_payload)
        prusa_payload = {'state': 'idle'}
        prusa = self.client.post('/stats/prusa_xl/printer3d/', prusa_payload, format='json')
        self.assertEqual(prusa.status_code, status.HTTP_200_OK)
        self.assertEqual(cache.get('printer3d')['prusa_xl'], prusa_payload)
        unknown_printer = self.client.post('/stats/unknown/printer3d/', {'state': 'ignored'}, format='json')
        self.assertEqual(unknown_printer.status_code, status.HTTP_200_OK)
        self.assertNotIn('unknown', cache.get('printer3d'))

        card = models.Card.objects.create(user=self.user, card_number='scanner-route-card')
        scanner = self.client.post('/stats/raptorx1/scanner3d/', {
            'status': 'IN_USE', 'card_number': card.card_number,
        }, format='json')
        self.assertEqual(scanner.status_code, status.HTTP_200_OK)
        self.assertEqual(cache.get('scanner3d')['raptorx1']['status'], 'In Use')
        unknown_scanner = self.client.post('/stats/other-scanner/scanner3d/', {'status': 'FREE'}, format='json')
        self.assertEqual(unknown_scanner.status_code, status.HTTP_200_OK)
        self.assertNotIn('other-scanner', cache.get('scanner3d'))

        self.client.post('/stats/solar_data/', {'user': 'roof', 'power': '100'}, format='json')
        self.client.post('/stats/solar_data/', {'user': 'garage', 'power': '50'}, format='json')
        self.assertEqual(cache.get('solar')['total'], 150)
        cache.set('solar', {'users': {
            'stale': {'power': 500, 'time': timezone.now().timestamp() - 1801},
        }})
        fresh_solar = self.client.post('/stats/solar_data/', {
            'user': 'fresh', 'power': '10',
        }, format='json')
        self.assertEqual(fresh_solar.status_code, status.HTTP_200_OK)
        self.assertEqual(cache.get('solar')['total'], 10)
        self.assertEqual(self.client.post('/stats/balloon_data/', {
            'data': {'positions': [{'lat': 1, 'lon': 2}], 'stats': {'height': 3}},
        }, format='json').status_code, status.HTTP_200_OK)
        self.assertEqual(self.client.get('/stats/balloon_data/').data['stats']['height'], 3)

    def test_stats_device_routes_reject_missing_fields_and_bad_tokens(self):
        cases = [
            ('/stats/sign/', {}, status.HTTP_400_BAD_REQUEST),
            ('/stats/vestaboard/', {}, status.HTTP_400_BAD_REQUEST),
            ('/stats/track/', {'username': 'route.tester'}, status.HTTP_400_BAD_REQUEST),
            ('/stats/track/', {'name': 'DEVICE'}, status.HTTP_400_BAD_REQUEST),
            ('/stats/autoscan/', {}, status.HTTP_400_BAD_REQUEST),
            ('/stats/garden/', {}, status.HTTP_400_BAD_REQUEST),
            ('/stats/solar_data/', {}, status.HTTP_400_BAD_REQUEST),
            ('/stats/solar_data/', {'user': 'roof'}, status.HTTP_400_BAD_REQUEST),
            ('/stats/balloon_data/', {}, status.HTTP_400_BAD_REQUEST),
            ('/stats/raptorx1/scanner3d/', {}, status.HTTP_400_BAD_REQUEST),
            ('/stats/raptorx1/scanner3d/', {'status': 'FREE'}, status.HTTP_400_BAD_REQUEST),
        ]
        for path, data, expected_status in cases:
            with self.subTest(path=path, data=data):
                response = self.client.post(path, data, format='json')
                self.assertEqual(response.status_code, expected_status)

        with patch('apiserver.api.views.secrets.ALARM_API_TOKEN', 'alarm-secret'):
            unauthorized = self.client.post(
                '/stats/alarm/', {'data': 'Armed away'},
                HTTP_AUTHORIZATION='Bearer wrong', format='json',
            )
        self.assertEqual(unauthorized.status_code, status.HTTP_403_FORBIDDEN)
        missing_data = self.client.post('/stats/alarm/', {}, format='json')
        self.assertEqual(missing_data.status_code, status.HTTP_400_BAD_REQUEST)

    def test_general_auth_user_ping_paste_backup_and_ipn_routes(self):
        user_response = self.client.get('/user/')
        self.assertEqual(user_response.status_code, status.HTTP_200_OK)
        self.assertEqual(user_response.data['username'], self.user.username)
        ping = self.client.post('/ping/', {}, format='json')
        self.assertEqual(ping.status_code, status.HTTP_200_OK)
        self.assertEqual(ping.data['app_version'], settings.APP_VERSION)

        self.assertEqual(self.client.get('/paste/').status_code, status.HTTP_200_OK)
        posted = self.client.post('/paste/', {'paste': 'hello paste'}, format='json')
        self.assertEqual(posted.status_code, status.HTTP_200_OK)
        self.assertEqual(cache.get('paste'), 'hello paste')
        missing_paste = self.client.post('/paste/', {}, format='json')
        self.assertEqual(missing_paste.status_code, status.HTTP_400_BAD_REQUEST)

        backup = APIClient().get('/backup/')
        self.assertEqual(backup.status_code, status.HTTP_200_OK)
        self.assertIsInstance(backup.data, list)

        with patch('apiserver.api.views.utils_paypal.process_paypal_ipn') as process_ipn:
            ipn = self.client.post(reverse('ipn'), {'txn_type': 'test'}, format='json')
        self.assertEqual(ipn.status_code, status.HTTP_200_OK)
        process_ipn.assert_called_once()
        with patch('apiserver.api.views.utils_paypal.process_paypal_ipn', side_effect=RuntimeError('bad IPN')):
            failed_ipn = self.client.post(reverse('ipn'), {'txn_type': 'bad'}, format='json')
        self.assertEqual(failed_ipn.status_code, status.HTTP_500_INTERNAL_SERVER_ERROR)

    def test_login_logout_password_change_reset_and_confirm_routes(self):
        self.assertTrue(self.user.check_password('oldpassword'))
        with patch('apiserver.api.throttles.LoggingThrottle.allow_request', return_value=True):
            login = APIClient().post('/rest-auth/login/', {
                'username': self.user.username, 'password': 'oldpassword',
            }, format='json')
        self.assertEqual(login.status_code, status.HTTP_200_OK, login.data)
        self.assertIn('key', login.data)

        with patch('apiserver.api.throttles.LoggingThrottle.allow_request', return_value=True), \
             patch('apiserver.api.utils_auth.set_discourse_password') as set_discourse, \
             patch('apiserver.api.utils_auth.add_discourse_group_members') as add_group:
            spaceport_login = APIClient().post('/spaceport-auth/login/', {
                'username': self.user.username, 'password': 'oldpassword',
            }, format='json')
        self.assertEqual(spaceport_login.status_code, status.HTTP_200_OK)
        set_discourse.assert_called_once()
        add_group.assert_called_once()

        token, _ = Token.objects.get_or_create(user=self.user)
        logout = APIClient().post('/rest-auth/logout/', HTTP_AUTHORIZATION='Token ' + token.key)
        self.assertEqual(logout.status_code, status.HTTP_200_OK)
        self.assertFalse(Token.objects.filter(user=self.user).exists())

        with patch('apiserver.api.throttles.LoggingThrottle.allow_request', return_value=True), \
             patch('apiserver.api.serializers.time.sleep'), \
             patch('apiserver.api.utils_auth.discourse_is_configured', return_value=False), \
             patch('apiserver.api.utils_ldap.is_configured', return_value=False):
            changed = self.client.post('/password/change/', {
                'old_password': 'oldpassword',
                'new_password1': 'ComplexPass123!',
                'new_password2': 'ComplexPass123!',
            }, format='json')
        self.assertEqual(changed.status_code, status.HTTP_200_OK)

        with override_settings(EMAIL_BACKEND='django.core.mail.backends.locmem.EmailBackend'), \
             patch('apiserver.api.throttles.LoggingThrottle.allow_request', return_value=True):
            reset = APIClient().post('/password/reset/', {'email': self.user.email}, format='json')
        self.assertEqual(reset.status_code, status.HTTP_200_OK)

        uid = urlsafe_base64_encode(force_bytes(self.user.pk))
        reset_token = default_token_generator.make_token(self.user)
        with patch('apiserver.api.throttles.LoggingThrottle.allow_request', return_value=True), \
             patch('apiserver.api.serializers.time.sleep'), \
             patch('apiserver.api.utils_auth.discourse_is_configured', return_value=False), \
             patch('apiserver.api.utils_ldap.is_configured', return_value=False):
            confirm = APIClient().post('/password/reset/confirm/', {
                'uid': uid,
                'token': reset_token,
                'new_password1': 'ChangedPass123!',
                'new_password2': 'ChangedPass123!',
            }, format='json')
        self.assertEqual(confirm.status_code, status.HTTP_200_OK)
        self.user.refresh_from_db()
        self.assertTrue(self.user.check_password('ChangedPass123!'))

        null_confirm = APIClient().get('/password/reset/confirm/{}/{}/'.format(uid, reset_token))
        self.assertEqual(null_confirm.status_code, status.HTTP_404_NOT_FOUND)

    def test_oidc_openid_admin_and_debug_api_auth_routes(self):
        from django.http import HttpResponseRedirect
        from oidc_provider.models import Client as OIDCClient

        client = OIDCClient.objects.create(name='wiki_dev', client_id='route-oidc-client')
        self.assertIsNotNone(client.id)
        with patch('oidc_provider.views.AuthorizeView.get', return_value=HttpResponseRedirect('https://wiki.example/authorize')):
            oidc = self.client.get('/oidc/?client_id=route-oidc-client')
        self.assertEqual(oidc.status_code, status.HTTP_200_OK)
        self.assertEqual(oidc.data['url'], 'https://wiki.example/authorize')

        openid = APIClient().get('/openid/authorize/')
        self.assertLess(openid.status_code, status.HTTP_500_INTERNAL_SERVER_ERROR)
        admin_response = APIClient().get(reverse('admin:index'))
        self.assertEqual(admin_response.status_code, status.HTTP_302_FOUND)

        try:
            resolve('/api-auth/login/')
        except Resolver404:
            return  # These routes are only installed when DEBUG=True.
        self.assertLess(APIClient().get('/api-auth/login/').status_code, 500)
