from django.core.management.base import BaseCommand, CommandError
from django.contrib.auth.models import User
from django.db.models import Max, F, Count, Q, Sum
from django.utils.timezone import now
from django.core.cache import cache
from django.db import transaction
from dateutil import relativedelta
import math

from apiserver import secrets, settings
from apiserver.api import models, utils, utils_email

import time

class Command(BaseCommand):
    help = 'Bill Trotec laser usage for last month. Wise to run this on the 2nd of each month to prevent any timezone issues.'

    FREE_MINUTES = 60 * 6
    DEVICE = 'TROTECS300'
    DEVICE_NAME = 'Trotec'
    DOLLARS_PER_MINUTE = 0.50

    def bill_trotec(self):
        count = 0

        now = utils.now_alberta_tz()
        current_month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        previous_month_start = current_month_start - relativedelta.relativedelta(months=1)

        self.stdout.write('Billing from {} to {}...'.format(
            previous_month_start,
            current_month_start,
        ))

        usages = models.Usage.objects.order_by('id').filter(should_bill=True)
        month_trotec_usages = usages.filter(
            started_at__gte=previous_month_start,
            started_at__lt=current_month_start,
            device=self.DEVICE,
        )

        month_trotec_user_ids = month_trotec_usages.values_list('user', flat=True).distinct()
        month_trotec_users = User.objects.filter(id__in=month_trotec_user_ids)

        self.stdout.write('Found {} usages by {} users.'.format(
            month_trotec_usages.count(),
            month_trotec_users.count(),
        ))

        for user in month_trotec_users:
            if not user:
                continue

            self.stdout.write('Billing {}:'.format(user.username))

            users_usages = month_trotec_usages.filter(
                user=user,
            )

            total_seconds = users_usages.aggregate(Sum('num_seconds'))['num_seconds__sum'] or 0
            total_minutes = math.ceil(total_seconds / 60.0)
            billable_minutes = total_minutes - self.FREE_MINUTES

            self.stdout.write('    Total seconds: {}'.format(total_seconds))
            self.stdout.write('    Total minutes: {}'.format(total_minutes))
            self.stdout.write('    Billable minutes: {}'.format(billable_minutes))

            if billable_minutes <= 0:
                self.stdout.write('    Skipping, used free time.')
                continue

            bill = billable_minutes * self.DOLLARS_PER_MINUTE
            bill_str = format(bill, '.2f')

            self.stdout.write('    Total bill: ${}'.format(bill_str))

            utils_email.send_usage_bill_email(
                user,
                self.DEVICE_NAME,
                previous_month_start.strftime('%B'),
                total_minutes,
                billable_minutes,
                bill_str,
            )

            self.stdout.write('    Sent usage bill email.')

            count += 1

        return count

    def handle(self, *args, **options):
        self.stdout.write('{} - Billing Trotec'.format(str(now())))
        start = time.time()

        count = self.bill_trotec()
        self.stdout.write('Billed {} members'.format(count))

        self.stdout.write('Completed billing in {} s'.format(
            str(time.time() - start)[:4]
        ))
