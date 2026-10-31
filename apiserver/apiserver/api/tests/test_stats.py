import os
import tarfile
import tempfile
from datetime import datetime, timedelta
from unittest.mock import Mock, call, patch

from django.contrib.auth.models import User
from django.core.cache import cache
from django.core.management import call_command
from django.test import TestCase
from django.urls import reverse
from django.utils.timezone import now
from rest_framework import status
from rest_framework.test import APIClient

from apiserver import secrets, settings
from apiserver.api import models, utils, utils_stats
from apiserver.api.management.commands import generate_backups, run_daily, run_hourly


class StatsTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.admin = User.objects.create_user(
            username='stats.admin', password='password', is_staff=True,
        )
        models.Member.objects.create(
            user=cls.admin,
            first_name='Stats',
            last_name='Admin',
            preferred_name='Stats Admin',
        )

    def setUp(self):
        cache.clear()
        self.client = APIClient()
        self.client.force_authenticate(user=self.admin)

    def create_member(self, username, **member_fields):
        user = User.objects.create_user(username=username, password='password')
        fields = dict(
            user=user,
            first_name=username,
            last_name='Stats',
            preferred_name=username,
        )
        fields.update(member_fields)
        return models.Member.objects.create(**fields)

    def create_session(self, course, datetime, **session_fields):
        fields = dict(course=course, datetime=datetime, cost=0)
        fields.update(session_fields)
        return models.Session.objects.create(**fields)

    def test_calc_next_events_and_upcoming_class_count(self):
        current = now()
        future = current + timedelta(days=2)
        past = current - timedelta(days=2)

        meeting_course = models.Course.objects.create(id=317, name='Member meeting')
        clean_course = models.Course.objects.create(id=273, name='Monthly clean')
        regular_course = models.Course.objects.create(name='Woodworking')
        event_course = models.Course.objects.create(name='Open house', tags='Event')
        outing_course = models.Course.objects.create(name='Outing', tags='Outing')
        protospace_course = models.Course.objects.create(name='Community class', tags='Protospace')

        meeting = self.create_session(meeting_course, future)
        clean = self.create_session(clean_course, future + timedelta(hours=1))
        upcoming = self.create_session(regular_course, future + timedelta(hours=2))
        previous = self.create_session(regular_course, past)
        self.create_session(regular_course, future, max_students=1)
        self.create_session(regular_course, future, is_cancelled=True)
        self.create_session(event_course, future + timedelta(hours=3))
        self.create_session(outing_course, future + timedelta(hours=4))
        self.create_session(protospace_course, future + timedelta(hours=5))

        utils_stats.calc_next_events()

        self.assertEqual(cache.get('next_meeting'), meeting.datetime)
        self.assertEqual(cache.get('next_clean'), clean.datetime)
        self.assertEqual(cache.get('next_class'), dict(
            datetime=upcoming.datetime,
            id=upcoming.id,
            name='Woodworking',
        ))
        self.assertEqual(cache.get('prev_class'), dict(
            datetime=previous.datetime,
            id=previous.id,
            name='Woodworking',
        ))
        # Meetings and cleans count as upcoming; events, outings, Protospace
        # events, cancelled sessions, and one-person sessions do not.
        self.assertEqual(cache.get('upcoming_classes'), 3)

    def test_next_events_include_now_boundary_and_select_earliest_cleanup(self):
        instant = datetime(2026, 11, 1, 6, 0, tzinfo=now().tzinfo)
        meeting_course = models.Course.objects.create(id=317, name='Meeting')
        clean_course = models.Course.objects.create(id=273, name='Cleanup')
        class_course = models.Course.objects.create(name='Boundary class')

        # Insert later events first so the tests detect queries that rely on
        # insertion order instead of selecting the earliest scheduled event.
        self.create_session(meeting_course, instant + timedelta(hours=4))
        meeting = self.create_session(meeting_course, instant + timedelta(hours=2))
        # Create the later cleanup first to ensure the calculation orders by
        # scheduled time rather than relying on insertion order.
        self.create_session(clean_course, instant + timedelta(days=2))
        earliest_clean = self.create_session(clean_course, instant + timedelta(hours=1))
        exactly_now = self.create_session(class_course, instant)
        previous = self.create_session(class_course, instant - timedelta(seconds=1))
        self.create_session(class_course, instant + timedelta(seconds=1))

        with patch.object(utils_stats, 'now', return_value=instant):
            utils_stats.calc_next_events()

        self.assertEqual(cache.get('next_meeting'), meeting.datetime)
        self.assertEqual(cache.get('next_clean'), earliest_clean.datetime)
        self.assertEqual(cache.get('next_class')['id'], exactly_now.id)
        self.assertEqual(cache.get('prev_class')['id'], exactly_now.id)

    def test_alberta_time_does_not_fall_back_on_november_1_2026(self):
        # Alberta's new permanent Alberta Time is UTC-6; the former 1:00 a.m.
        # fall-back hour must be an ordinary, unambiguous local time.
        local_times = [
            datetime(2026, 11, 1, 0, 30),
            datetime(2026, 11, 1, 1, 30),
            datetime(2026, 11, 1, 2, 30),
            datetime(2026, 12, 1, 12, 0),
        ]
        for local_time in local_times:
            with self.subTest(local_time=local_time):
                localized = utils.DISPLAY_TZ.localize(local_time, is_dst=None)
                self.assertEqual(localized.utcoffset(), -timedelta(hours=6))

    def test_card_scans_use_new_alberta_midnight_boundary(self):
        alberta_date = datetime(2026, 11, 1).date()
        utc_midnight = datetime(2026, 11, 1, 6, 0, tzinfo=now().tzinfo)
        models.Card.objects.create(
            card_number='before-abt-midnight',
            last_seen=utc_midnight - timedelta(seconds=1),
        )
        models.Card.objects.create(
            card_number='at-abt-midnight',
            last_seen=utc_midnight,
        )
        models.Card.objects.create(
            card_number='next-abt-day',
            last_seen=utc_midnight + timedelta(days=1),
        )

        with patch.object(utils, 'today_local_tz', return_value=alberta_date):
            utils_stats.calc_card_scans()

        self.assertEqual(cache.get('card_scans'), 1)
        self.assertEqual(
            models.StatsSpaceActivity.objects.get(date=alberta_date).card_scans,
            1,
        )

    def test_calc_next_events_clears_stale_cache_when_no_events_exist(self):
        for key in ('next_meeting', 'next_clean', 'next_class', 'prev_class'):
            cache.set(key, 'stale value')
        cache.set('upcoming_classes', 17)

        utils_stats.calc_next_events()

        for key in ('next_meeting', 'next_clean', 'next_class', 'prev_class'):
            self.assertIsNone(cache.get(key))
        self.assertEqual(cache.get('upcoming_classes'), 0)

    def test_calc_card_scans_counts_local_today_and_upserts_daily_activity(self):
        today = utils.today_local_tz()
        local_midnight = utils.DISPLAY_TZ.localize(
            datetime.combine(today, datetime.min.time())
        )
        models.Card.objects.create(card_number='scan-today-1', last_seen=local_midnight)
        models.Card.objects.create(
            card_number='scan-today-2',
            last_seen=now().astimezone(utils.DISPLAY_TZ),
        )
        models.Card.objects.create(
            card_number='scan-yesterday',
            last_seen=local_midnight - timedelta(seconds=1),
        )
        models.Card.objects.create(
            card_number='scan-tomorrow',
            last_seen=local_midnight + timedelta(days=1),
        )

        utils_stats.calc_card_scans()
        self.assertEqual(cache.get('card_scans'), 2)
        daily = models.StatsSpaceActivity.objects.get(date=today)
        self.assertEqual(daily.card_scans, 2)

        # Re-running the daily calculation updates the row instead of adding a
        # duplicate, and reflects scans that have since been added or removed.
        models.Card.objects.create(card_number='scan-today-3', last_seen=now())
        utils_stats.calc_card_scans()
        self.assertEqual(cache.get('card_scans'), 3)
        self.assertEqual(models.StatsSpaceActivity.objects.filter(date=today).count(), 1)
        self.assertEqual(models.StatsSpaceActivity.objects.get(date=today).card_scans, 3)

    def test_member_counts_are_cached_and_calculated(self):
        today = utils.today_local_tz()
        old_member = self.create_member(
            'stats.current', status='Current', application_date=today - timedelta(days=200),
            vetted_date=today,
        )
        self.create_member('stats.prepaid', status='Prepaid', application_date=today)
        self.create_member('stats.due', status='Due', application_date=today)
        self.create_member('stats.overdue', status='Overdue', application_date=today)
        self.create_member(
            'stats.paused', status='Current', paused_date=today,
            application_date=today - timedelta(days=300),
        )
        models.Transaction.objects.create(
            user=old_member.user,
            amount=10,
            category='Membership',
            date=today,
            number_of_membership_months=1,
            paypal_txn_type='subscr_payment',
        )

        counts = utils_stats.calc_member_counts()

        expected = dict(
            member_count=4,
            green_count=2,
            six_month_plus_count=1,
            vetted_count=1,
            subscriber_count=1,
        )
        self.assertEqual(counts, expected)
        self.assertEqual(cache.get('member_count'), 4)
        self.assertEqual(cache.get('green_count'), 2)
        # The test admin's Member has no active membership status, so it is
        # included in the non-counted member total as well as the paused one.
        self.assertEqual(cache.get('paused_count'), 2)

    def test_stats_and_extras_routes_use_cache_and_hide_private_fields(self):
        cache.set('member_count', 42)
        cache.set('card_scans', 8)
        cache.set('classes_week', [{'class': 'Cached class'}])
        cache.set('alarm', {'data': 'TRIGGERED'})
        cache.set('autoscan', 'secret state')
        removed_stats_keys = (
            'paused_count',
            'green_count',
            'bay_108_temp',
            'bay_110_temp',
            'scanner3d',
            'protoballoon',
        )
        for key in removed_stats_keys:
            cache.set(key, 'stale cached value')

        response = self.client.get(reverse('stats-list'))
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['member_count'], 42)
        self.assertEqual(response.data['card_scans'], 8)
        self.assertEqual(response.data['alarm'], {'data': 'TRIGGERED'})
        self.assertEqual(response.data['autoscan'], 'secret state')
        for key in removed_stats_keys:
            self.assertNotIn(key, response.data)

        extras = self.client.get(reverse('stats-extras'))
        self.assertEqual(extras.status_code, status.HTTP_200_OK)
        self.assertEqual(extras.data['classes_week'], [{'class': 'Cached class'}])

        anonymous = APIClient().get(reverse('stats-list'))
        self.assertEqual(anonymous.status_code, status.HTTP_200_OK)
        self.assertNotIn('alarm', anonymous.data)
        self.assertNotIn('autoscan', anonymous.data)

        ordinary_user = User.objects.create_user(username='stats.member')
        models.Member.objects.create(
            user=ordinary_user,
            first_name='Stats',
            last_name='Member',
            preferred_name='Stats Member',
        )
        self.client.force_authenticate(user=ordinary_user)
        ordinary = self.client.get(reverse('stats-list'))
        self.assertEqual(ordinary.status_code, status.HTTP_200_OK)
        self.assertIn('alarm', ordinary.data)
        self.assertNotIn('autoscan', ordinary.data)

    def test_external_status_checks_and_todo_lists_populate_cache(self):
        minecraft_response = Mock()
        minecraft_response.json.return_value = {
            'players': {'sample': [{'name': 'block-builder'}]},
        }
        mumble_response = Mock(text='voice user')

        shopping_tasks = [{
            'title': 'Filament',
            'created': '2026-01-01',
            'labels': [{'title': '3D printing'}, {'title': 'urgent'}],
        }]
        maintenance_tasks = [{
            'title': 'Fix sink',
            'created': '2026-01-02',
            'labels': None,
        }]

        with patch.object(utils_stats.secrets, 'MINECRAFT', 'minecraft.example'), \
             patch.object(utils_stats.secrets, 'MUMBLE', 'https://mumble.example/status'), \
             patch.object(utils_stats.requests, 'get', side_effect=[
                 minecraft_response, mumble_response,
             ]) as request_get, \
             patch.object(utils_stats.utils_todo, 'is_configured', return_value=True), \
             patch.object(utils_stats.utils_todo, 'get_task_list', side_effect=[
                 shopping_tasks, maintenance_tasks,
             ]) as get_task_list:
            self.assertEqual(utils_stats.check_minecraft_server(), ['block-builder'])
            self.assertEqual(utils_stats.check_mumble_server(), ['voice', 'user'])
            utils_stats.check_shopping_list()
            utils_stats.check_maintenance_list()

        self.assertEqual(cache.get('minecraft_players'), ['block-builder'])
        self.assertEqual(cache.get('mumble_users'), ['voice', 'user'])
        self.assertEqual(cache.get('shopping_list'), [{
            'title': 'Filament',
            'created': '2026-01-01',
            'labels': ['3D printing', 'urgent'],
        }])
        self.assertEqual(cache.get('maintenance_list'), [{
            'title': 'Fix sink',
            'created': '2026-01-02',
            'labels': [],
        }])
        self.assertEqual(request_get.call_count, 2)
        get_task_list.assert_has_calls([call('Consumables'), call('Maintenance')])

    def test_progress_helper_and_api_route_read_and_replace_cached_status(self):
        utils_stats.set_progress('stats-request', 'Starting')
        utils_stats.set_progress('stats-request', 'Halfway')
        self.assertEqual(
            self.client.get(reverse('stats-progress'), {'request_id': 'stats-request'}).data,
            ['Starting', 'Halfway'],
        )

        utils_stats.set_progress('stats-request', 'Complete', replace=True)
        response = self.client.get(
            reverse('stats-progress'), {'request_id': 'stats-request'},
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data, ['Starting', 'Complete'])
        missing = self.client.get(reverse('stats-progress'))
        self.assertEqual(missing.status_code, status.HTTP_400_BAD_REQUEST)

    def test_run_minutely_command_calls_integrations_and_finishes(self):
        with patch.object(utils_stats, 'check_minecraft_server', return_value=['player']), \
             patch.object(utils_stats, 'check_mumble_server', return_value=['member']), \
             patch.object(utils_stats, 'check_shopping_list', return_value=[{'title': 'soap'}]) as shopping, \
             patch.object(utils_stats, 'check_maintenance_list', return_value=[{'title': 'repair'}]) as maintenance:
            output = call_command('run_minutely')

        self.assertIsNone(output)
        shopping.assert_called_once_with()
        maintenance.assert_called_once_with()

    def test_run_hourly_generates_daily_and_monthly_stats(self):
        today = utils.today_local_tz()
        current_member = self.create_member(
            'hourly.current', status='Current', application_date=today - timedelta(days=200),
            vetted_date=today,
        )
        self.create_member('hourly.prepaid', status='Prepaid', application_date=today)
        self.create_member(
            'hourly.paused', status='Current', paused_date=today,
            application_date=today - timedelta(days=300),
        )
        models.Transaction.objects.create(
            user=current_member.user,
            amount=10,
            category='Membership',
            date=today,
            number_of_membership_months=1,
            paypal_txn_type='subscr_payment',
        )

        with patch.object(utils_stats, 'calc_drink_sales'), \
             patch.object(utils_stats, 'calc_dues_distribution'), \
             patch.object(utils_stats, 'calc_year_distribution'), \
             patch.object(utils_stats, 'calc_cert_distribution'), \
             patch.object(utils_stats, 'calc_year_attendance'), \
             patch.object(utils_stats, 'calc_classes_week'), \
             patch.object(utils, 'gen_search_strings') as gen_search_strings:
            call_command('run_hourly')

        daily = models.StatsMemberCount.objects.get(date=today)
        self.assertEqual(daily.member_count, 2)
        self.assertEqual(daily.green_count, 2)
        self.assertEqual(daily.six_month_plus_count, 1)
        self.assertEqual(daily.vetted_count, 1)
        self.assertEqual(daily.subscriber_count, 1)
        monthly = models.StatsSignupCount.objects.get(month=today.replace(day=1))
        # The admin fixture also has an application date in the current month.
        self.assertEqual(monthly.signup_count, 2)
        self.assertEqual(cache.get('card_scans'), 0)
        self.assertEqual(cache.get('upcoming_classes'), 0)
        gen_search_strings.assert_called_once_with()

    def test_run_daily_tallies_members_updates_retention_and_discourse_groups(self):
        today = utils.today_local_tz()
        active = self.create_member(
            'daily.active', status='Current', application_date=today,
            discourse_username='active_user', is_director=True, is_instructor=True,
        )
        paused = self.create_member(
            'daily.paused', status='Current', application_date=today,
            paused_date=today, discourse_username='former_user',
        )
        models.StatsSignupCount.objects.create(month=today.replace(day=1), signup_count=2)

        with patch.object(utils, 'tally_membership_months') as tally, \
             patch.object(run_daily.utils_auth, 'add_discourse_group_members') as add_group, \
             patch.object(run_daily.utils_auth, 'remove_discourse_group_members') as remove_group:
            call_command('run_daily')

        self.assertEqual(tally.call_count, 2)
        self.assertEqual(
            {call.args[0].id for call in tally.call_args_list},
            {active.id, self.admin.member.id},
        )
        signup = models.StatsSignupCount.objects.get(month=today.replace(day=1))
        self.assertEqual(signup.retain_count, 2)
        self.assertEqual(signup.vetted_count, 0)
        self.assertIsNotNone(cache.get('last_card_change'))

        add_calls = {args[0]: args[1] for args, _kwargs in add_group.call_args_list}
        remove_calls = {args[0]: args[1] for args, _kwargs in remove_group.call_args_list}
        self.assertEqual(add_calls['protospace_members'], ['active_user'])
        self.assertEqual(add_calls['directors_current'], ['active_user'])
        self.assertEqual(add_calls['protospace_instructors'], ['active_user'])
        self.assertEqual(add_calls['protospace_members_former'], ['former_user'])
        self.assertEqual(remove_calls['protospace_members'], ['former_user'])
        self.assertEqual(remove_calls['directors_current'], ['former_user'])

    def test_generate_backups_creates_archive_and_sets_download_cache_path(self):
        tokens = {
            'test-token': {
                'name': 'stats.backup',
                'backup_id': 'backup-id',
                'cache_key': 'stats-backup-path',
            },
            'canary-token': {
                'name': 'null',
                'backup_id': 'canary-id',
                'cache_key': 'canary-backup-path',
            },
        }
        with tempfile.TemporaryDirectory() as temp_dir:
            api_dir = os.path.join(temp_dir, 'api')
            data_dir = os.path.join(api_dir, 'data')
            static_dir = os.path.join(data_dir, 'static')
            backup_dir = os.path.join(temp_dir, 'backups')
            os.makedirs(static_dir)
            os.makedirs(backup_dir)
            with open(os.path.join(data_dir, 'fixture.txt'), 'w') as data_file:
                data_file.write('backup fixture contents')

            with patch.dict(secrets.BACKUP_TOKENS, tokens, clear=True), \
                 patch.object(generate_backups, 'API_FOLDER', api_dir), \
                 patch.object(generate_backups, 'DATA_FOLDER', data_dir), \
                 patch.object(generate_backups, 'BACKUP_FOLDER', backup_dir):
                call_command('generate_backups')

            self.assertTrue(models.MetaInfo.objects.filter(id=0).exists())
            relative_path = cache.get('stats-backup-path')
            self.assertIsNotNone(relative_path)
            self.assertIsNone(cache.get('canary-backup-path'))
            archive_path = os.path.join(backup_dir, relative_path)
            self.assertTrue(os.path.isfile(archive_path))
            with tarfile.open(archive_path, 'r:gz') as archive:
                self.assertIn('data/fixture.txt', archive.getnames())
                extracted = archive.extractfile('data/fixture.txt')
                self.assertEqual(extracted.read(), b'backup fixture contents')

    def test_backup_route_download_redirect_and_records_download_time(self):
        today = now().date()
        tokens = {
            'download-token': {
                'name': 'stats.backup',
                'backup_id': 'backup-id',
                'cache_key': 'stats-backup-path',
            },
        }
        cache.set('stats-backup-path', 'abc/spaceport-backup-{}.tar.gz'.format(today))

        with patch.dict(secrets.BACKUP_TOKENS, tokens, clear=True), \
             patch.object(settings, 'PRODUCTION_HOST', 'example.test'):
            response = self.client.get(
                reverse('backup'),
                HTTP_AUTHORIZATION='Bearer download-token',
            )
            self.assertEqual(response.status_code, status.HTTP_302_FOUND)
            self.assertEqual(
                response['Location'],
                'https://static.example.test/backups/abc/spaceport-backup-{}.tar.gz'.format(today),
            )

            listing = APIClient().get(reverse('backup'))

        self.assertEqual(listing.status_code, status.HTTP_200_OK)
        self.assertEqual(listing.data[0]['backup_user'], 'stats.backup')
        self.assertIsNotNone(listing.data[0]['download_time'])
        self.assertTrue(listing.data[0]['less_than_24h'])

    def test_backup_route_rejects_invalid_or_unavailable_downloads(self):
        tokens = {
            'valid-token': {
                'name': 'stats.backup',
                'backup_id': 'backup-id',
                'cache_key': 'stats-backup-path',
            },
        }
        with patch.dict(secrets.BACKUP_TOKENS, tokens, clear=True):
            forbidden = self.client.get(
                reverse('backup'),
                HTTP_AUTHORIZATION='Bearer invalid-token',
            )
            self.assertEqual(forbidden.status_code, status.HTTP_403_FORBIDDEN)

            missing = self.client.get(
                reverse('backup'),
                HTTP_AUTHORIZATION='Bearer valid-token',
            )
            self.assertEqual(missing.status_code, status.HTTP_404_NOT_FOUND)

            cache.set('stats-backup-path', 'abc/spaceport-backup-2020-01-01.tar.gz')
            stale = self.client.get(
                reverse('backup'),
                HTTP_AUTHORIZATION='Bearer valid-token',
            )
            self.assertEqual(stale.status_code, status.HTTP_503_SERVICE_UNAVAILABLE)
