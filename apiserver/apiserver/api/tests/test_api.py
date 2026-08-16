from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase
from apiserver.api.models import Member, User
import json
import itertools
from django.utils import timezone
from parameterized import parameterized
from django.test import override_settings

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
        client = APIClient()
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
            cost=10
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
                    'max_students': 5
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
                'cost': 15.00
            }
            response = self.client.post(list_url, data, format='json')
            self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
            self.assertTrue(mock_alert.called)
            self.assertIn('Past class creation detected', mock_alert.call_args[0][0])

        with patch('apiserver.api.utils.alert_tanner') as mock_alert:
            # Invalid Update
            response = self.client.patch(f'/sessions/{session.id}/', {'datetime': past_date, 'instructor_id': privileged_member.id}, format='json')
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
