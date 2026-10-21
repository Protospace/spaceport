from decimal import Decimal

from django.contrib.auth.models import User
from django.test import TestCase
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient

from apiserver.api import models


class HistoryTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.user = User.objects.create_user(
            username='history.member',
            email='history@example.com',
            password='password',
            is_staff=True,
        )
        cls.member = models.Member.objects.create(
            user=cls.user,
            first_name='History',
            last_name='Member',
            preferred_name='History',
        )

    def setUp(self):
        self.api_client = APIClient()
        self.api_client.force_authenticate(user=self.user)

    def make_tracked_objects(self):
        """Create and update every model that is included in the history index."""
        course = models.Course.objects.create(name='History course')
        session = models.Session.objects.create(
            course=course,
            instructor=self.user,
            cost=Decimal('10.00'),
        )
        transaction = models.Transaction.objects.create(
            user=self.user,
            amount=Decimal('10.00'),
            category='Donation',
        )
        paypal_hint = models.PayPalHint.objects.create(
            user=self.user,
            account='history-paypal-account',
            member_id=self.member.id,
        )
        card = models.Card.objects.create(
            user=self.user,
            card_number='history-card',
            active_status='card_active',
            notes='Initial card note',
        )
        training = models.Training.objects.create(
            user=self.user,
            session=session,
            attendance_status='Confirmed',
        )
        storage = models.StorageSpace.objects.create(
            user=self.user,
            shelf_id='history-shelf',
            classification='SHELF',
            memo='Initial memo',
        )
        drawing = models.Drawing.objects.create(
            owner=self.user,
            filename='history-drawing.svg',
        )

        cases = [
            (self.member, [
                ('preferred_name', 'History', 'History Updated'),
                ('phone', '', '555-0100'),
            ]),
            (transaction, [
                ('amount', '10.00', '12.00'),
                ('category', 'Donation', 'Purchases'),
            ]),
            (paypal_hint, [
                ('member_id', str(self.member.id), str(self.member.id + 1)),
                ('account', 'history-paypal-account', 'updated-paypal-account'),
            ]),
            (card, [
                ('active_status', 'card_active', 'card_inactive'),
                ('notes', 'Initial card note', 'Updated card note'),
            ]),
            (course, [
                ('name', 'History course', 'Updated history course'),
                ('tags', '', 'safety,wood'),
            ]),
            (session, [
                ('cost', '10.00', '15.00'),
                ('is_cancelled', 'False', 'True'),
            ]),
            (training, [
                ('attendance_status', 'Confirmed', 'Attended'),
                ('member_id', 'None', '77'),
            ]),
            (storage, [
                ('memo', 'Initial memo', 'Updated memo'),
                ('classification', 'SHELF', 'LOCKER'),
            ]),
            (drawing, [
                ('is_hidden', 'False', 'True'),
                ('filename', 'history-drawing.svg', 'updated-history-drawing.svg'),
            ]),
        ]

        for obj, changes in cases:
            for field, _old, new in changes:
                if field in ('amount', 'cost'):
                    setattr(obj, field, Decimal(new))
                elif field in ('member_id',) and new != 'None':
                    setattr(obj, field, int(new))
                elif field in ('is_hidden', 'is_cancelled'):
                    setattr(obj, field, new == 'True')
                else:
                    setattr(obj, field, new)
            obj.save()

        return cases

    def history_index_for(self, obj, history_type='Changed'):
        # HistoryIndex's generic object_id identifies a historical row, not
        # the live model row, so resolve it back to the original object ID.
        return next(
            index for index in models.HistoryIndex.objects.filter(
                object_name=obj.__class__.__name__,
                history_type=history_type,
            )
            if index.history.id == obj.pk
        )

    def test_all_indexed_models_record_creation_and_updates(self):
        cases = self.make_tracked_objects()

        # Every indexed object should have a creation and a change record. This
        # checks the underlying simple-history tables as well as the index
        # signal that populates the /history/ endpoint.
        for obj, changes in cases:
            with self.subTest(model=obj.__class__.__name__):
                self.assertEqual(obj.history.count(), 2)
                records = list(obj.history.order_by('history_date'))
                self.assertEqual([record.history_type for record in records], ['+', '~'])

                index = self.history_index_for(obj)
                self.assertEqual(index.changes.count(), len(changes))
                for field, old, new in changes:
                    with self.subTest(field=field):
                        change = index.changes.get(field=field)
                        self.assertEqual(change.old, old)
                        self.assertEqual(change.new, new)

    def test_history_api_lists_changes_for_every_tracked_model(self):
        cases = self.make_tracked_objects()
        response = self.api_client.get(reverse('history-list'))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        results = response.data['results']

        for obj, changes in cases:
            with self.subTest(model=obj.__class__.__name__):
                index = self.history_index_for(obj)
                entry = next(result for result in results if result['id'] == index.id)
                for field, old, new in changes:
                    with self.subTest(field=field):
                        change = next(
                            change for change in entry['changes']
                            if change['field'] == field
                        )
                        self.assertEqual(change['old'], old)
                        self.assertEqual(change['new'], new)

                created_index = self.history_index_for(obj, history_type='Created')
                created_entry = next(
                    result for result in results if result['id'] == created_index.id
                )
                self.assertEqual(created_entry['changes'], [])

    def test_history_api_truncates_long_course_descriptions(self):
        old_description = 'old description ' * 20
        new_description = 'new description ' * 20
        course = models.Course.objects.create(
            name='Long description course',
            description=old_description,
        )
        course.description = new_description
        course.save()

        index = self.history_index_for(course)
        change = index.changes.get(field='description')
        expected_old = old_description[:200] + '... [truncated]'
        expected_new = new_description[:200] + '... [truncated]'
        self.assertEqual(change.old, expected_old)
        self.assertEqual(change.new, expected_new)
        # The index truncates its display copy; the model history remains full.
        self.assertEqual(course.history.first().description, new_description)

        response = self.api_client.get(reverse('history-list'))
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        entry = next(result for result in response.data['results'] if result['id'] == index.id)
        description_change = next(
            item for item in entry['changes'] if item['field'] == 'description'
        )
        self.assertEqual(description_change['old'], expected_old)
        self.assertEqual(description_change['new'], expected_new)

    def test_history_api_filters_by_owner_and_system_changes(self):
        self.make_tracked_objects()

        member_response = self.api_client.get(
            reverse('history-list'),
            {'member_id': self.member.id},
        )
        self.assertEqual(member_response.status_code, status.HTTP_200_OK)
        self.assertTrue(member_response.data['results'])
        self.assertTrue(all(
            entry['owner_id'] == self.member.id
            for entry in member_response.data['results']
        ))

        non_system_response = self.api_client.get(
            reverse('history-list'),
            {'exclude_system': 'true'},
        )
        self.assertEqual(non_system_response.status_code, status.HTTP_200_OK)
        self.assertEqual(non_system_response.data['results'], [])

    def test_models_excluded_from_history_index_still_keep_simple_history(self):
        # The index callback intentionally omits User and IPN records. They
        # should still be tracked in their simple-history tables.
        user = User.objects.get(pk=self.user.pk)
        user.email = 'updated-history@example.com'
        user.save()

        ipn = models.IPN.objects.create(data='first payload', status='Received')
        ipn.status = 'Processed'
        ipn.save()

        self.assertEqual(user.history.count(), 2)
        self.assertEqual(user.history.first().email, 'updated-history@example.com')
        self.assertEqual(ipn.history.count(), 2)
        self.assertEqual(ipn.history.first().status, 'Processed')
        self.assertFalse(models.HistoryIndex.objects.filter(object_name='IPN').exists())
        self.assertFalse(models.HistoryIndex.objects.filter(object_name='User').exists())

    def test_history_api_requires_an_admin(self):
        self.api_client.force_authenticate(user=None)
        response = self.api_client.get(reverse('history-list'))
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

        ordinary_user = User.objects.create_user(
            username='history.nonadmin',
            password='password',
        )
        self.api_client.force_authenticate(user=ordinary_user)
        response = self.api_client.get(reverse('history-list'))
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
