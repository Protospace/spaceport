from django.test import TestCase
import datetime
from dateutil import relativedelta
from rest_framework.exceptions import ValidationError
from rest_framework.test import APIClient

from apiserver.api import utils, utils_paypal, models


class TestParsePayPalDate(TestCase):
    def test_parse(self):
        string = '20:12:59 Jan 13, 2009 PST'

        result = utils_paypal.parse_paypal_date(string)

        self.assertEqual(str(result), '2009-01-14 04:12:59+00:00')

    def test_parse_dst(self):
        string = '20:12:59 Jul 13, 2009 PDT'

        result = utils_paypal.parse_paypal_date(string)

        self.assertEqual(str(result), '2009-07-14 03:12:59+00:00')

    def test_parse_bad_tz(self):
        string = '20:12:59 Jul 13, 2009 QOT'

        self.assertRaises(ValidationError, utils_paypal.parse_paypal_date, string)

    def test_parse_bad_string(self):
        string = 'ave satanas'

        self.assertRaises(ValidationError, utils_paypal.parse_paypal_date, string)
