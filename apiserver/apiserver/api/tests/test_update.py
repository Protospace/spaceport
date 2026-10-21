import json
import os
import tempfile
from datetime import timedelta
from decimal import Decimal
from unittest.mock import patch

from django.contrib.auth.models import User
from django.test import TestCase
from django.urls import re_path, resolve, reverse
from django.utils.functional import Promise
from django.utils.timezone import now
from django.utils.translation import gettext_lazy
try:
    from pypdf import PdfReader
except ImportError:
    try:
        from PyPDF2 import PdfReader
    except ImportError:
        from PyPDF2 import PdfFileReader as PdfReader

from apiserver.api import models, serializers, utils, views


class DependencyUpgradeCompatibilityTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.user = User.objects.create_user(
            username='upgrade.instructor',
            email='upgrade@example.com',
            password='password',
        )
        cls.member = models.Member.objects.create(
            user=cls.user,
            first_name='Upgrade',
            last_name='Compatibility',
            preferred_name='Upgrade',
            is_instructor=True,
            application_date=None,
        )
        cls.course = models.Course.objects.create(
            name='Compatibility test course',
            description='Check the API serialization contract.',
        )

    def test_named_api_routes_still_resolve(self):
        # Django 4.0 removed django.conf.urls.url(). These important legacy
        # routes must remain importable and reversible during the URL migration.
        expected = {
            'rest_name_register': ('/registration/', r'^registration/'),
            'rest_login': ('/rest-auth/login/', r'^rest-auth/login/$'),
            'session-list': ('/sessions/', r'^sessions/$'),
            'history-list': ('/history/', r'^history/$'),
            'stats-list': ('/stats/', r'^stats/$'),
            'backup': ('/backup/', r'^backup/'),
        }

        for route_name, (path, equivalent_pattern) in expected.items():
            with self.subTest(route=route_name):
                self.assertEqual(reverse(route_name), path)
                actual_match = resolve(path)
                replacement_match = re_path(
                    equivalent_pattern,
                    actual_match.func,
                    name=route_name,
                ).resolve(path.lstrip('/'))
                self.assertIsNotNone(replacement_match)
                self.assertEqual(replacement_match.url_name, actual_match.url_name)
                self.assertEqual(replacement_match.func, actual_match.func)

    def test_gettext_lazy_preserves_lazy_translation_behavior(self):
        translated_by_project = utils._('Welcome to Protospace')
        translated_by_current_api = gettext_lazy('Welcome to Protospace')

        self.assertIsInstance(translated_by_project, Promise)
        self.assertIsInstance(translated_by_current_api, Promise)
        self.assertEqual(str(translated_by_project), str(translated_by_current_api))

    def test_session_decimal_and_integer_boundaries_validate(self):
        # DRF 3.16 changed DecimalField min/max validation. Keep the API's
        # documented inclusive limits stable through a serializer upgrade.
        valid_cases = [
            ('0.00', 1),
            ('200.00', 50),
            ('15.25', None),
        ]
        for cost, max_students in valid_cases:
            with self.subTest(cost=cost, max_students=max_students):
                serializer = serializers.SessionSerializer(data={
                    'course': self.course.id,
                    'datetime': (now() + timedelta(days=3)).isoformat(),
                    'cost': cost,
                    'max_students': max_students,
                })
                self.assertTrue(serializer.is_valid(), serializer.errors)
                session = serializer.save(instructor=self.user)
                self.assertEqual(session.cost, Decimal(cost))
                self.assertEqual(session.max_students, max_students)

        invalid_cases = [
            ('-0.01', 5),
            ('200.01', 5),
            ('10.00', 0),
            ('10.00', 51),
        ]
        for cost, max_students in invalid_cases:
            with self.subTest(cost=cost, max_students=max_students):
                serializer = serializers.SessionSerializer(data={
                    'course': self.course.id,
                    'datetime': (now() + timedelta(days=3)).isoformat(),
                    'cost': cost,
                    'max_students': max_students,
                })
                self.assertFalse(serializer.is_valid())
                self.assertTrue(serializer.errors)

    def test_session_datetime_stays_timezone_aware_after_round_trip(self):
        local_datetime = utils.now_local_tz().replace(microsecond=0) + timedelta(days=2)
        session = models.Session.objects.create(
            course=self.course,
            instructor=self.user,
            datetime=local_datetime,
            cost=Decimal('20.00'),
        )

        serialized = serializers.SessionSerializer(session).data
        returned_datetime = serializers.SessionSerializer().fields['datetime'].to_internal_value(
            serialized['datetime']
        )

        self.assertIsNotNone(returned_datetime.utcoffset())
        self.assertEqual(
            returned_datetime.astimezone(utils.DISPLAY_TZ),
            local_datetime.astimezone(utils.DISPLAY_TZ),
        )

    def test_icalendar_generation_keeps_event_fields_and_timezone(self):
        local_datetime = utils.now_local_tz().replace(microsecond=0) + timedelta(days=3)
        session = models.Session.objects.create(
            course=self.course,
            instructor=self.user,
            datetime=local_datetime,
            cost=Decimal('0.00'),
        )

        ical_data = views.SessionViewSet().generate_ical(session)

        self.assertIn(b'BEGIN:VCALENDAR', ical_data)
        self.assertIn(b'BEGIN:VEVENT', ical_data)
        self.assertIn(b'SUMMARY:Compatibility test course', ical_data)
        self.assertIn(b'DTSTART', ical_data)
        self.assertIn(b'DTEND', ical_data)

    def test_member_form_generation_produces_a_readable_pdf(self):
        # PyPDF2 2.x/3.x renamed PdfFileReader/Writer and their camelCase
        # methods. Exercise the real merge/write path so that a PDF-library
        # upgrade cannot silently break generated membership forms.
        with tempfile.TemporaryDirectory() as temp_dir:
            form_template = os.path.join(temp_dir, 'blank_member_form.pdf')
            output_dir = os.path.join(temp_dir, 'generated')
            os.mkdir(output_dir)
            with open(utils.BLANK_FORM, 'rb') as source, open(form_template, 'wb') as target:
                target.write(source.read())

            with patch.object(utils, 'BLANK_FORM', form_template), \
                 patch.object(utils, 'STATIC_FOLDER', output_dir + os.path.sep):
                utils.gen_member_forms(self.member)

            self.member.refresh_from_db()
            self.assertTrue(self.member.member_forms)
            generated_path = os.path.join(output_dir, self.member.member_forms)
            self.assertTrue(os.path.isfile(generated_path))
            with open(generated_path, 'rb') as pdf_file:
                self.assertEqual(pdf_file.read(5), b'%PDF-')
            reader = PdfReader(generated_path)
            page_count = len(reader.pages) if hasattr(reader, 'pages') else reader.getNumPages()
            self.assertEqual(page_count, 3)
            self.assertGreater(os.path.getsize(generated_path), 1000)

    def test_framework_serializer_error_payloads_remain_json_serializable(self):
        # DRF/Django releases have changed ErrorDetail and ErrorDict rendering.
        # Confirm validation responses retain the JSON shape the frontend uses.
        serializer = serializers.SessionSerializer(data={
            'course': self.course.id,
            'datetime': (now() + timedelta(days=3)).isoformat(),
            'cost': '201.00',
            'max_students': 5,
        })
        self.assertFalse(serializer.is_valid())
        response_body = json.loads(json.dumps(serializer.errors))
        self.assertIn('cost', response_body)
        self.assertIn('less than or equal to 200', response_body['cost'][0])
