import django, sys, os
os.environ['DJANGO_SETTINGS_MODULE'] = 'apiserver.settings'
django.setup()

from django.test import TestCase
import datetime
from dateutil import relativedelta
from rest_framework.exceptions import ValidationError

from apiserver.api import utils, utils_paypal, models

testing_member, _ = models.Member.objects.get_or_create(
    first_name='unittest',
    preferred_name='unittest',
    last_name='tester',
)

class TestMonthsSpanned(TestCase):
    def test_num_months_spanned_one_month(self):
        date2 = datetime.date(2020, 1, 10)
        date1 = datetime.date(2020, 2, 10)

        spanned = utils.num_months_spanned(date1, date2)

        self.assertEqual(spanned, 1)

    def test_num_months_spanned_one_week(self):
        date1 = datetime.date(2020, 2, 5)
        date2 = datetime.date(2020, 1, 28)

        spanned = utils.num_months_spanned(date1, date2)

        self.assertEqual(spanned, 1)

    def test_num_months_spanned_two_days(self):
        date1 = datetime.date(2020, 2, 1)
        date2 = datetime.date(2020, 1, 31)

        spanned = utils.num_months_spanned(date1, date2)

        self.assertEqual(spanned, 1)

    def test_num_months_spanned_two_years(self):
        date1 = datetime.date(2022, 1, 18)
        date2 = datetime.date(2020, 1, 18)

        spanned = utils.num_months_spanned(date1, date2)

        self.assertEqual(spanned, 24)

    def test_num_months_spanned_same_month(self):
        date1 = datetime.date(2020, 1, 31)
        date2 = datetime.date(2020, 1, 1)

        spanned = utils.num_months_spanned(date1, date2)

        self.assertEqual(spanned, 0)


class TestMonthsDifference(TestCase):
    def test_num_months_difference_one_month(self):
        date2 = datetime.date(2020, 1, 10)
        date1 = datetime.date(2020, 2, 10)

        difference = utils.num_months_difference(date1, date2)

        self.assertEqual(difference, 1)

    def test_num_months_difference_one_week(self):
        date1 = datetime.date(2020, 2, 5)
        date2 = datetime.date(2020, 1, 28)

        difference = utils.num_months_difference(date1, date2)

        self.assertEqual(difference, 0)

    def test_num_months_difference_two_days(self):
        date1 = datetime.date(2020, 2, 1)
        date2 = datetime.date(2020, 1, 31)

        difference = utils.num_months_difference(date1, date2)

        self.assertEqual(difference, 0)

    def test_num_months_difference_two_years(self):
        date1 = datetime.date(2022, 1, 18)
        date2 = datetime.date(2020, 1, 18)

        difference = utils.num_months_difference(date1, date2)

        self.assertEqual(difference, 24)

    def test_num_months_difference_same_month(self):
        date1 = datetime.date(2020, 1, 31)
        date2 = datetime.date(2020, 1, 1)

        difference = utils.num_months_difference(date1, date2)

        self.assertEqual(difference, 0)


class TestAddMonths(TestCase):
    def test_add_months_one_month(self):
        date = datetime.date(2020, 1, 18)
        num_months = 1

        new_date = utils.add_months(date, num_months)

        self.assertEqual(new_date, datetime.date(2020, 2, 18))

    def test_add_months_february(self):
        date = datetime.date(2020, 1, 31)
        num_months = 1

        new_date = utils.add_months(date, num_months)

        self.assertEqual(new_date, datetime.date(2020, 2, 29))

    def test_add_months_february_leap(self):
        date = datetime.date(2020, 2, 29)
        num_months = 12

        new_date = utils.add_months(date, num_months)

        self.assertEqual(new_date, datetime.date(2021, 2, 28))

    def test_add_months_hundred_years(self):
        date = datetime.date(2020, 1, 31)
        num_months = 1200

        new_date = utils.add_months(date, num_months)

        self.assertEqual(new_date, datetime.date(2120, 1, 31))


class TestCalcStatus(TestCase):
    def test_calc_member_status_14_days(self):
        expire_date = utils.today_alberta_tz() + datetime.timedelta(days=14)

        status = utils.calc_member_status(expire_date)

        self.assertEqual(status, 'Current')

    def test_calc_member_status_1_month(self):
        today = datetime.date(2019, 2, 10)
        expire_date = datetime.date(2019, 3, 10)

        status = utils.calc_member_status(expire_date, today)

        self.assertEqual(status, 'Current')

    def test_calc_member_status_90_days(self):
        expire_date = utils.today_alberta_tz() + datetime.timedelta(days=90)

        status = utils.calc_member_status(expire_date)

        self.assertEqual(status, 'Prepaid')

    def test_calc_member_status_tomorrow(self):
        expire_date = utils.today_alberta_tz() + datetime.timedelta(days=1)

        status = utils.calc_member_status(expire_date)

        self.assertEqual(status, 'Current')

    def test_calc_member_status_today(self):
        expire_date = utils.today_alberta_tz()

        status = utils.calc_member_status(expire_date)

        self.assertEqual(status, 'Due')

    def test_calc_member_status_yesterday(self):
        expire_date = utils.today_alberta_tz() - datetime.timedelta(days=1)

        status = utils.calc_member_status(expire_date)

        self.assertEqual(status, 'Due')

    def test_calc_member_status_1_month_ago(self):
        today = datetime.date(2019, 4, 10)
        expire_date = datetime.date(2019, 3, 10)

        status = utils.calc_member_status(expire_date, today)

        self.assertEqual(status, 'Overdue')

    def test_calc_member_status_85_days_ago(self):
        expire_date = utils.today_alberta_tz() - datetime.timedelta(days=85)

        status = utils.calc_member_status(expire_date)

        self.assertEqual(status, 'Overdue')

    def test_calc_member_status_95_days_ago(self):
        expire_date = utils.today_alberta_tz() - datetime.timedelta(days=95)

        status = utils.calc_member_status(expire_date)

        self.assertEqual(status, 'Former Member')


class TestTallyMembership(TestCase):
    def get_member_clear_transactions(self):
        member = testing_member
        member.paused_date = None
        member.expire_date = None
        return member

    def test_tally_membership_months_prepaid(self):
        member = self.get_member_clear_transactions()
        test_num_months = 8
        start_date = utils.today_alberta_tz() - relativedelta.relativedelta(months=6, days=14)
        end_date = start_date + relativedelta.relativedelta(months=test_num_months)

        member.current_start_date = start_date
        member.save()

        for i in range(test_num_months):
            models.Transaction.objects.create(
                amount=0,
                member_id=member.id,
                number_of_membership_months=1,
            )

        result = utils.tally_membership_months(member)

        self.assertEqual(member.expire_date, end_date)
        self.assertEqual(member.status, 'Prepaid')

    def test_tally_membership_months_current(self):
        member = self.get_member_clear_transactions()
        test_num_months = 7
        start_date = utils.today_alberta_tz() - relativedelta.relativedelta(months=6, days=14)
        end_date = start_date + relativedelta.relativedelta(months=test_num_months)

        member.current_start_date = start_date
        member.save()

        for i in range(test_num_months):
            models.Transaction.objects.create(
                amount=0,
                member_id=member.id,
                number_of_membership_months=1,
            )

        result = utils.tally_membership_months(member)

        self.assertEqual(member.expire_date, end_date)
        self.assertEqual(member.status, 'Current')

    def test_tally_membership_months_due(self):
        member = self.get_member_clear_transactions()
        test_num_months = 6
        start_date = utils.today_alberta_tz() - relativedelta.relativedelta(months=6, days=14)
        end_date = start_date + relativedelta.relativedelta(months=test_num_months)

        member.current_start_date = start_date
        member.save()

        for i in range(test_num_months):
            models.Transaction.objects.create(
                amount=0,
                member_id=member.id,
                number_of_membership_months=1,
            )

        result = utils.tally_membership_months(member)

        self.assertEqual(member.expire_date, end_date)
        self.assertEqual(member.status, 'Due')

    def test_tally_membership_months_overdue(self):
        member = self.get_member_clear_transactions()
        test_num_months = 5
        start_date = utils.today_alberta_tz() - relativedelta.relativedelta(months=6, days=14)
        end_date = start_date + relativedelta.relativedelta(months=test_num_months)

        member.current_start_date = start_date
        member.save()

        for i in range(test_num_months):
            models.Transaction.objects.create(
                amount=0,
                member_id=member.id,
                number_of_membership_months=1,
            )

        result = utils.tally_membership_months(member)

        self.assertEqual(member.expire_date, end_date)
        self.assertEqual(member.status, 'Overdue')

    def test_tally_membership_months_overdue_pause(self):
        member = self.get_member_clear_transactions()
        test_num_months = 1
        start_date = utils.today_alberta_tz() - relativedelta.relativedelta(months=6, days=14)
        end_date = start_date + relativedelta.relativedelta(months=test_num_months)

        member.current_start_date = start_date
        member.save()

        for i in range(test_num_months):
            models.Transaction.objects.create(
                amount=0,
                member_id=member.id,
                number_of_membership_months=1,
            )

        result = utils.tally_membership_months(member)

        self.assertEqual(member.expire_date, end_date)
        self.assertEqual(member.paused_date, end_date)
        self.assertEqual(member.status, 'Former Member')

    def test_tally_membership_months_dont_run(self):
        member = self.get_member_clear_transactions()
        start_date = utils.today_alberta_tz()

        member.current_start_date = start_date
        member.paused_date = start_date
        member.save()

        result = utils.tally_membership_months(member)

        self.assertEqual(result, False)

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
