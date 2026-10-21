from datetime import date, datetime, timedelta
from decimal import Decimal
from unittest.mock import patch

from django.contrib.auth.models import User
from django.core.cache import cache
from django.db.models import Sum
from django.test import TestCase
from django.utils.timezone import now
from rest_framework import status
from rest_framework.exceptions import ValidationError
from rest_framework.test import APIClient

from apiserver import secrets
from apiserver.api import models, serializers, utils, utils_stats
from apiserver.api.management.commands import run_hourly


class RegressionFixTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.instructor = User.objects.create_user(
            username='fix.instructor', password='password', is_staff=True,
        )
        cls.instructor_member = models.Member.objects.create(
            user=cls.instructor,
            first_name='Fix',
            last_name='Instructor',
            preferred_name='Fix',
            is_instructor=True,
            application_date=None,
        )
        cls.student = User.objects.create_user(
            username='fix.student', password='password',
        )
        cls.student_member = models.Member.objects.create(
            user=cls.student,
            first_name='Fix',
            last_name='Student',
            preferred_name='Student',
            application_date=None,
        )

    def setUp(self):
        self.client = APIClient()
        self.client.force_authenticate(user=self.instructor)

    def make_member(self, username, **fields):
        user = User.objects.create_user(username=username, password='password')
        member_fields = dict(
            user=user,
            first_name=username,
            last_name='Regression',
            preferred_name=username,
            application_date=None,
        )
        member_fields.update(fields)
        return models.Member.objects.create(**member_fields)

    def test_string_methods_handle_null_relations_and_datetimes(self):
        tx = models.Transaction(
            user=None,
            date=date(2026, 1, 2),
            amount=Decimal('0.00'),
        )
        ipn = models.IPN(datetime=None, data='', status='Pending')
        session = models.Session(course=None, datetime=None, cost=Decimal('0.00'))
        training = models.Training(user=None, session=None)

        self.assertEqual(str(tx), 'None tx 2026-01-02')
        self.assertEqual(str(ipn), 'None')
        self.assertEqual(str(session), 'Unknown Course @ Unknown Time')
        self.assertEqual(str(training), 'None taking Unknown Course @ Unknown Time')

    def test_member_without_transactions_has_zero_protocoin_balance(self):
        data = serializers.MemberSerializer(self.student_member).data
        self.assertEqual(data['protocoin'], 0)
        self.assertEqual(data['total_protocoin'], 0)

    def test_year_distribution_omits_members_without_application_dates(self):
        self.make_member('fix.year.active', application_date=date(2024, 6, 1))
        self.make_member(
            'fix.year.inactive',
            application_date=date(2024, 7, 1),
            paused_date=date(2025, 1, 1),
        )
        self.make_member('fix.year.undated', application_date=None)

        utils_stats.calc_year_distribution()
        distribution = cache.get('year_dist')

        self.assertEqual(distribution, [{
            'application_date__year': 2024,
            'total': 2,
            'count': 1,
            'active': 1,
            'inactive': 1,
        }])

    def test_weekly_class_stats_exclude_cancelled_and_single_student_sessions(self):
        current = now()
        monday = current.replace(hour=12, minute=0, second=0, microsecond=0)
        monday -= timedelta(days=monday.weekday())
        regular = models.Course.objects.create(name='Weekly class')
        event = models.Course.objects.create(name='Weekly event', tags='Event')
        outing = models.Course.objects.create(name='Weekly outing', tags='Outing')
        protospace = models.Course.objects.create(name='Weekly Protospace class', tags='Protospace')

        sessions = [
            (regular, monday + timedelta(days=1), False, None),
            (event, monday + timedelta(days=2), False, None),
            (outing, monday + timedelta(days=3), False, None),
            (protospace, monday + timedelta(days=4), False, None),
            (regular, monday + timedelta(days=5), True, None),
            (regular, monday + timedelta(days=6), False, 1),
            (regular, None, False, None),
        ]
        for course, session_time, cancelled, max_students in sessions:
            models.Session.objects.create(
                course=course,
                datetime=session_time,
                cost=Decimal('0.00'),
                is_cancelled=cancelled,
                max_students=max_students,
            )

        utils_stats.calc_classes_week()
        weekly = cache.get('classes_week')

        self.assertEqual(len(weekly), 1)
        self.assertEqual(weekly[0]['total'], 4)
        self.assertEqual(weekly[0]['events'], 3)
        self.assertEqual(weekly[0]['classes'], 1)

    def test_year_attendance_excludes_event_outing_and_protospace_sessions(self):
        attendee = self.make_member('fix.attendee')
        course_types = [
            ('Regular class', ''),
            ('Public event', 'Event'),
            ('Community outing', 'Outing'),
            ('Protospace event', 'Protospace'),
        ]
        for name, tags in course_types:
            course = models.Course.objects.create(name=name, tags=tags)
            session = models.Session.objects.create(
                course=course,
                datetime=now(),
                cost=Decimal('0.00'),
            )
            models.Training.objects.create(
                user=attendee.user,
                session=session,
                attendance_status='Attended',
            )

        utils_stats.calc_year_attendance()

        self.assertEqual(cache.get('year_attendance'), [{
            'session__datetime__year': now().year,
            'attended_total': 1,
            'attended_active': 1,
            'attended_inactive': 0,
        }])

    def test_member_email_uniqueness_is_case_insensitive(self):
        duplicate = User.objects.create_user(
            username='fix.email.owner',
            email='email-already-used@example.com',
            password='password',
        )
        models.Member.objects.create(
            user=duplicate,
            first_name='Email',
            last_name='Owner',
            preferred_name='Email',
            application_date=None,
        )
        self.client.force_authenticate(user=self.student)

        response = self.client.patch(
            '/members/{}/'.format(self.student_member.id),
            {'email': 'EMAIL-ALREADY-USED@example.com'},
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('email', response.data)

    def test_negative_transaction_amounts_and_protocoin_spends_are_allowed(self):
        def make_serializer(category):
            serializer = serializers.TransactionSerializer(data={
                'member_id': self.student_member.id,
                'date': utils.today_local_tz().isoformat(),
                'account_type': 'Cash',
                'category': category,
                'amount': '-5.00',
            })
            self.assertTrue(serializer.is_valid(), serializer.errors)
            return serializer

        purchase_adjustment = make_serializer('Purchases').save()
        self.assertEqual(purchase_adjustment.amount, Decimal('-5.00'))

        reimburse = make_serializer('Reimburse').save()
        self.assertEqual(reimburse.amount, Decimal('-5.00'))

        models.Transaction.objects.create(
            user=self.student,
            amount=Decimal('0.00'),
            protocoin=Decimal('10.00'),
            account_type='Protocoin',
            category='Exchange',
        )
        protocoin_spend = serializers.TransactionSerializer(data={
            'member_id': self.student_member.id,
            'date': utils.today_local_tz().isoformat(),
            'account_type': 'Protocoin',
            'category': 'Snacks',
            'amount': '0.00',
            'protocoin': '-5.00',
        })
        self.assertTrue(protocoin_spend.is_valid(), protocoin_spend.errors)
        with patch('apiserver.api.serializers.utils.alert_tanner'):
            spend = protocoin_spend.save()
        self.assertEqual(spend.amount, Decimal('0.00'))
        self.assertEqual(spend.protocoin, Decimal('-5.00'))

    def test_duplicate_email_password_reset_returns_validation_error(self):
        email = 'duplicate-reset@example.com'
        User.objects.create_user(username='reset.first', email=email, password='password')
        User.objects.create_user(username='reset.second', email=email, password='password')

        serializer = serializers.MyPasswordResetSerializer(
            data={'email': email},
            context={'request': None},
        )
        self.assertTrue(serializer.is_valid())

        with patch('apiserver.api.serializers.utils.alert_tanner') as alert:
            with self.assertRaises(ValidationError) as raised:
                serializer.save()

        self.assertIn('two accounts with the same email', str(raised.exception))
        alert.assert_called_once()

    def test_session_interest_emails_respect_slot_limits_and_paused_members(self):
        course = models.Course.objects.create(name='Interest slot-limit course')
        active_interest = models.Interest.objects.create(
            user=self.student,
            course=course,
        )
        paused_member = self.make_member(
            'fix.paused',
            paused_date=utils.today_local_tz(),
        )
        paused_interest = models.Interest.objects.create(
            user=paused_member.user,
            course=course,
        )

        def create_data(max_students):
            return {
                'course': course.id,
                'instructor_id': self.instructor_member.id,
                'datetime': (now() + timedelta(days=3)).isoformat(),
                'cost': '10.00',
                'max_students': max_students,
            }

        with patch.object(utils_stats, 'calc_next_events'), \
             patch.object(utils_stats, 'calc_num_interested'), \
             patch('apiserver.api.views.utils_email.send_interest_email') as send_email:
            limited = self.client.post('/sessions/', create_data(2), format='json')
            self.assertEqual(limited.status_code, status.HTTP_201_CREATED, limited.data)
            send_email.assert_not_called()
            active_interest.refresh_from_db()
            paused_interest.refresh_from_db()
            self.assertIsNone(active_interest.satisfied_by)
            self.assertIsNone(paused_interest.satisfied_by)

            eligible = self.client.post('/sessions/', create_data(3), format='json')
            self.assertEqual(eligible.status_code, status.HTTP_201_CREATED, eligible.data)

        self.assertEqual(send_email.call_count, 1)
        active_interest.refresh_from_db()
        paused_interest.refresh_from_db()
        self.assertEqual(active_interest.satisfied_by_id, eligible.data['id'])
        self.assertIsNone(paused_interest.satisfied_by)

    def test_course_suggestion_uses_recent_aware_session_datetimes(self):
        course = models.Course.objects.create(name='Weekly suggestion course')
        local_now = utils.now_local_tz()
        for days_ago in (45, 30, 20, 14):
            models.Session.objects.create(
                course=course,
                instructor=self.instructor,
                datetime=local_now - timedelta(days=days_ago),
                cost=Decimal('0.00'),
            )

        with patch.object(utils, 'now_local_tz', return_value=local_now), \
             patch.object(utils, 'today_local_tz', return_value=local_now.date()):
            suggestion = serializers.CourseDetailSerializer(course).get_suggestion(course)

        self.assertEqual(suggestion['datetime'], local_now + timedelta(days=7))
        self.assertIsNotNone(suggestion['datetime'].utcoffset())

    def test_partial_session_update_without_datetime_preserves_existing_datetime(self):
        course = models.Course.objects.create(name='Patchable session course')
        session_datetime = now() + timedelta(days=10)
        session = models.Session.objects.create(
            course=course,
            instructor=self.instructor,
            datetime=session_datetime,
            cost=Decimal('10.00'),
        )
        serializer = serializers.SessionSerializer(
            instance=session,
            data={
                'cost': '15.00',
                'instructor_id': self.instructor_member.id,
            },
            partial=True,
        )
        self.assertTrue(serializer.is_valid(), serializer.errors)

        updated = serializer.save()

        self.assertEqual(updated.datetime, session_datetime)
        self.assertEqual(updated.cost, Decimal('15.00'))
        self.assertEqual(updated.instructor_id, self.instructor.id)

    def test_session_creation_without_request_id_completes_interest_work(self):
        course = models.Course.objects.create(name='Session without progress request')
        interest = models.Interest.objects.create(
            user=self.student,
            course=course,
        )
        session_time = now() + timedelta(days=3)
        payload = {
            'course': course.id,
            'instructor_id': self.instructor_member.id,
            'datetime': session_time.isoformat(),
            'cost': '10.00',
            'max_students': 3,
            # Deliberately omit request_id, which is normally supplied by UI progress tracking.
        }

        with patch.object(utils_stats, 'calc_next_events'), \
             patch.object(utils_stats, 'calc_num_interested'), \
             patch('apiserver.api.views.utils_email.send_interest_email') as send_email:
            response = self.client.post('/sessions/', payload, format='json')

        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        created_session = models.Session.objects.get(pk=response.data['id'])
        interest.refresh_from_db()
        self.assertEqual(interest.satisfied_by, created_session)
        send_email.assert_called_once()

    def test_instructor_cannot_register_themself_as_a_student(self):
        course = models.Course.objects.create(name='Instructor registration course')
        session = models.Session.objects.create(
            course=course,
            instructor=self.instructor,
            datetime=now() + timedelta(days=3),
            cost=Decimal('10.00'),
            max_students=5,
        )

        with patch('apiserver.api.views.utils.alert_tanner') as alert:
            response = self.client.post('/training/', {
                'session': session.id,
                'member_id': self.instructor_member.id,
                'attendance_status': 'Attended',
            }, format='json')

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('Can\'t register the instructor', str(response.data))
        self.assertFalse(models.Training.objects.filter(session=session).exists())
        alert.assert_called_once()

    def test_student_withdrawal_is_blocked_inside_24_hours_except_for_events(self):
        instant = now()
        regular_course = models.Course.objects.create(name='Regular withdrawal course')
        event_course = models.Course.objects.create(
            name='Partial event course',
            tags='Workshop,Event',
        )
        soon_session = models.Session.objects.create(
            course=regular_course,
            instructor=self.instructor,
            datetime=instant + timedelta(hours=23),
            cost=Decimal('10.00'),
        )
        soon_training = models.Training.objects.create(
            user=self.student,
            session=soon_session,
            attendance_status='Confirmed',
        )
        later_session = models.Session.objects.create(
            course=regular_course,
            instructor=self.instructor,
            datetime=instant + timedelta(hours=25),
            cost=Decimal('10.00'),
        )
        later_training = models.Training.objects.create(
            user=self.student,
            session=later_session,
            attendance_status='Confirmed',
        )
        event_session = models.Session.objects.create(
            course=event_course,
            instructor=self.instructor,
            datetime=instant + timedelta(hours=23),
            cost=Decimal('10.00'),
        )
        event_training = models.Training.objects.create(
            user=self.student,
            session=event_session,
            attendance_status='Confirmed',
        )
        self.client.force_authenticate(user=self.student)

        def withdraw(training):
            return self.client.patch(
                '/training/{}/'.format(training.id),
                {
                    'session': training.session_id,
                    'attendance_status': 'Withdrawn',
                },
                format='json',
            )

        with patch('apiserver.api.views.now', return_value=instant):
            too_late = withdraw(soon_training)
            allowed_early = withdraw(later_training)
            allowed_event = withdraw(event_training)

        self.assertEqual(too_late.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('24h', str(too_late.data))
        self.assertEqual(allowed_early.status_code, status.HTTP_200_OK, allowed_early.data)
        self.assertEqual(allowed_event.status_code, status.HTTP_200_OK, allowed_event.data)

    def test_withdrawn_trainings_do_not_block_class_registration_or_reenrollment(self):
        course = models.Course.objects.create(name='Available seat course')
        session = models.Session.objects.create(
            course=course,
            instructor=self.instructor,
            datetime=now() + timedelta(days=3),
            cost=Decimal('10.00'),
            max_students=1,
        )
        models.Training.objects.create(
            user=self.instructor,
            session=session,
            attendance_status='Withdrawn',
        )

        self.client.force_authenticate(user=self.student)
        registration = self.client.post('/training/', {
            'session': session.id,
            'attendance_status': 'Waiting for payment',
        }, format='json')
        self.assertEqual(registration.status_code, status.HTTP_201_CREATED, registration.data)

        reentry_session = models.Session.objects.create(
            course=course,
            instructor=self.instructor,
            datetime=now() + timedelta(days=4),
            cost=Decimal('10.00'),
            max_students=1,
        )
        withdrawn_training = models.Training.objects.create(
            user=self.student,
            session=reentry_session,
            attendance_status='Withdrawn',
        )
        reenrollment = self.client.patch(
            '/training/{}/'.format(withdrawn_training.id),
            {
                'session': reentry_session.id,
                'attendance_status': 'Waiting for payment',
            },
            format='json',
        )
        self.assertEqual(reenrollment.status_code, status.HTTP_200_OK, reenrollment.data)
        withdrawn_training.refresh_from_db()
        self.assertEqual(withdrawn_training.attendance_status, 'Waiting for payment')

    def test_hourly_class_reminders_skip_cancelled_and_partial_event_sessions(self):
        local_now = utils.now_local_tz().replace(minute=0, second=0, microsecond=0)
        reminder_time = local_now + timedelta(hours=6, minutes=30)
        regular_course = models.Course.objects.create(name='Reminder class')
        event_course = models.Course.objects.create(name='Partial event class', tags='Workshop,Event')
        outing_course = models.Course.objects.create(name='Outing class', tags='Outing,Protospace')
        meeting_course = models.Course.objects.create(id=317, name='Member meeting')

        models.Session.objects.create(
            course=regular_course,
            instructor=self.instructor,
            datetime=reminder_time,
            cost=0,
        )
        models.Session.objects.create(
            course=regular_course,
            instructor=self.instructor,
            datetime=reminder_time,
            cost=0,
            is_cancelled=True,
        )
        models.Session.objects.create(
            course=event_course,
            instructor=self.instructor,
            datetime=reminder_time,
            cost=0,
        )
        models.Session.objects.create(
            course=outing_course,
            instructor=self.instructor,
            datetime=reminder_time,
            cost=0,
        )
        models.Session.objects.create(
            course=meeting_course,
            instructor=self.instructor,
            datetime=reminder_time,
            cost=0,
        )

        with patch.object(run_hourly.utils, 'now_local_tz', return_value=local_now), \
             patch.object(utils, 'alert_tanner') as alert:
            sent = run_hourly.Command().send_class_reminders()

        self.assertEqual(sent, 1)
        alert.assert_called_once()
        self.assertIn('Reminder class', alert.call_args[0][0])

    def test_run_hourly_attendance_reminders_skip_empty_attended_cancelled_and_event_classes(self):
        local_now = utils.now_local_tz().replace(minute=0, second=0, microsecond=0)
        reminder_time = local_now - timedelta(hours=6, minutes=30)
        regular_course = models.Course.objects.create(name='Attendance reminder class')
        event_course = models.Course.objects.create(name='Outing lesson', tags='Workshop,Outing')

        eligible = models.Session.objects.create(
            course=regular_course,
            instructor=self.instructor,
            datetime=reminder_time,
            cost=0,
        )
        empty = models.Session.objects.create(
            course=regular_course,
            instructor=self.instructor,
            datetime=reminder_time,
            cost=0,
        )
        attended = models.Session.objects.create(
            course=regular_course,
            instructor=self.instructor,
            datetime=reminder_time,
            cost=0,
        )
        cancelled = models.Session.objects.create(
            course=regular_course,
            instructor=self.instructor,
            datetime=reminder_time,
            cost=0,
            is_cancelled=True,
        )
        event = models.Session.objects.create(
            course=event_course,
            instructor=self.instructor,
            datetime=reminder_time,
            cost=0,
        )
        for session, attendance in (
            (eligible, 'Confirmed'),
            (attended, 'Attended'),
            (cancelled, 'Confirmed'),
            (event, 'Confirmed'),
        ):
            models.Training.objects.create(
                user=self.student,
                session=session,
                attendance_status=attendance,
            )
        self.assertFalse(empty.students.exists())

        with patch.object(run_hourly.utils, 'now_local_tz', return_value=local_now), \
             patch.object(utils, 'alert_tanner') as alert:
            sent = run_hourly.Command().send_attendance_reminders()

        self.assertEqual(sent, 1)
        alert.assert_called_once()
        self.assertIn('Attendance reminder', alert.call_args[0][0])
        self.assertIn('Attendance reminder class', alert.call_args[0][0])

    def test_training_refund_records_the_staff_user_as_transaction_recorder(self):
        course = models.Course.objects.create(name='Refund course')
        session = models.Session.objects.create(
            course=course,
            instructor=self.instructor,
            datetime=now() + timedelta(days=3),
            cost=Decimal('12.50'),
        )
        training = models.Training.objects.create(
            user=self.student,
            session=session,
            attendance_status='Confirmed',
            paid_date=date(2026, 10, 1),
        )

        response = self.client.post('/training/{}/refund/'.format(training.id))

        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        refund = models.Transaction.objects.get(user=self.student, category='OnAcct')
        self.assertEqual(refund.recorder, self.instructor)
        self.assertEqual(refund.protocoin, Decimal('12.50'))
        training.refresh_from_db()
        self.assertEqual(training.attendance_status, 'Withdrawn')
        self.assertIsNone(training.paid_date)

    def test_protocoin_balance_comparison_allows_small_decimal_rounding_error(self):
        models.Transaction.objects.create(
            user=self.instructor,
            amount=0,
            protocoin=Decimal('100.00'),
            account_type='Protocoin',
            category='Exchange',
        )

        response = self.client.post('/protocoin/spend_request/', {
            'balance': '100.005',
            'amount': '10.00',
            'category': 'Consumables',
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        self.assertEqual(
            self.instructor.transactions.aggregate(total=Sum('protocoin'))['total'],
            Decimal('90.00'),
        )

        stale_balance = self.client.post('/protocoin/spend_request/', {
            'balance': '90.02',
            'amount': '1.00',
            'category': 'Consumables',
        }, format='json')
        self.assertEqual(stale_balance.status_code, status.HTTP_400_BAD_REQUEST)

    def test_protocoin_member_transfer_rolls_back_if_second_ledger_entry_fails(self):
        recipient = self.make_member('fix.recipient')
        models.Transaction.objects.create(
            user=self.instructor,
            amount=0,
            protocoin=Decimal('100.00'),
            account_type='Protocoin',
            category='Exchange',
        )
        original_create = models.Transaction.objects.create
        creates = []

        def create_then_fail_on_recipient(*args, **kwargs):
            creates.append(kwargs.get('user'))
            if len(creates) == 2:
                raise RuntimeError('simulated recipient ledger write failure')
            return original_create(*args, **kwargs)

        with patch.object(
            models.Transaction.objects,
            'create',
            side_effect=create_then_fail_on_recipient,
        ):
            with self.assertRaises(RuntimeError):
                self.client.post('/protocoin/send_to_member/', {
                    'member_id': recipient.id,
                    'balance': '100.00',
                    'amount': '10.00',
                }, format='json')

        self.assertEqual(len(creates), 2)
        self.assertEqual(models.Transaction.objects.filter(user=self.instructor).count(), 1)
        self.assertFalse(models.Transaction.objects.filter(user=recipient.user).exists())
        self.assertEqual(
            self.instructor.transactions.aggregate(total=Sum('protocoin'))['total'],
            Decimal('100.00'),
        )

    def test_pinball_scores_must_end_in_zero_and_updates_are_idempotent(self):
        with patch.object(secrets, 'PINBALL_API_TOKEN', ''):
            invalid = self.client.post('/pinball/score/', {
                'game_id': 501,
                'player': 1,
                'score': 12345,
            }, format='json')
            self.assertEqual(invalid.status_code, status.HTTP_400_BAD_REQUEST)
            self.assertFalse(models.PinballScore.objects.exists())

            valid_payload = {'game_id': 501, 'player': 1, 'score': 12340}
            first = self.client.post('/pinball/score/', valid_payload, format='json')
            self.assertEqual(first.status_code, status.HTTP_200_OK)

            valid_payload['score'] = 67890
            second = self.client.post('/pinball/score/', valid_payload, format='json')

        self.assertEqual(second.status_code, status.HTTP_200_OK)
        self.assertEqual(models.PinballScore.objects.count(), 1)
        self.assertEqual(models.PinballScore.objects.get().score, 67890)

    def test_unvetted_storage_responses_abbreviate_other_members_surnames(self):
        owner = self.make_member(
            'fix.shelf.owner',
            first_name='Shelf',
            preferred_name='Shelf Owner',
            last_name='Confidential',
        )
        shelf = models.StorageSpace.objects.create(
            user=owner.user,
            shelf_id='FIX-PRIVACY',
            classification='SHELF',
        )

        self.client.force_authenticate(user=self.student)
        unvetted = self.client.get('/storage/{}/'.format(shelf.id))
        self.assertEqual(unvetted.status_code, status.HTTP_200_OK)
        self.assertEqual(unvetted.data['member_name'], 'Shelf Owner C.')
        self.assertNotIn('Confidential', unvetted.data['member_name'])

        vetted = self.make_member(
            'fix.vetted',
            vetted_date=utils.today_local_tz(),
        )
        self.client.force_authenticate(user=vetted.user)
        full_name = self.client.get('/storage/{}/'.format(shelf.id))
        self.assertEqual(full_name.status_code, status.HTTP_200_OK)
        self.assertEqual(full_name.data['member_name'], 'Shelf Owner Confidential')

    def test_search_stale_cached_member_id_gives_hourly_rebuild_hint(self):
        with patch('apiserver.api.views.cache.touch', return_value=True), \
             patch('apiserver.api.views.cache.get', return_value={'ghost member': 999999}):
            with self.assertRaises(models.Member.DoesNotExist) as raised:
                self.client.post('/search/', {
                    'q': 'ghost',
                    'page': 0,
                }, format='json')

        self.assertIn('regenerate search strings', str(raised.exception))
        self.assertIn('run_hourly', str(raised.exception))

    def test_superuser_without_member_profile_cannot_use_member_login(self):
        superuser = User.objects.create_superuser(
            username='fix.root',
            email='fix.root@example.com',
            password='password',
        )
        serializer = serializers.MyLoginSerializer(
            data={'username': superuser.username, 'password': 'password'},
            context={'request': object()},
        )

        self.assertFalse(serializer.is_valid())
        self.assertIn('superuser', serializer.errors['username'][0].lower())

    def test_monthly_hosting_leaderboard_sums_current_month_hours(self):
        host = self.make_member('fix.host')
        local_now = utils.now_local_tz()
        month_start = local_now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

        models.Hosting.objects.create(
            user=host.user,
            finished_at=month_start + timedelta(seconds=1),
            hours=Decimal('2.00'),
        )
        models.Hosting.objects.create(
            user=host.user,
            finished_at=month_start + timedelta(seconds=2),
            hours=Decimal('3.00'),
        )
        models.Hosting.objects.create(
            user=host.user,
            finished_at=month_start - timedelta(seconds=1),
            hours=Decimal('100.00'),
        )

        response = self.client.get('/hosting/monthly_high_scores/')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        score = next(item for item in response.data if item['member_id'] == host.id)
        self.assertEqual(score['hours'], Decimal('5.00'))
