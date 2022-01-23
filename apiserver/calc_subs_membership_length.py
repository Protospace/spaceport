import django, sys, os
os.environ['DJANGO_SETTINGS_MODULE'] = 'apiserver.settings'
django.setup()

from django.db.models import Prefetch, Sum
from apiserver.api import models, utils

today = utils.today_alberta_tz()

members = models.Member.objects.filter(paused_date__isnull=True)
related_tx = Prefetch(
    'user__transactions',
    queryset=models.Transaction.objects.filter(category='Membership'),
)

sub_total = 0
sub_count = 0
other_total = 0
other_count = 0

for member in members.prefetch_related(related_tx):
    name = member.preferred_name + ' ' + member.last_name[0]
    start = member.application_date
    length = today - member.application_date
    days = length.days

    if member.user.transactions.count():
        if member.user.transactions.latest('date').paypal_txn_type == 'subscr_payment':
            print('subscriber,{},{},{}'.format(name, start, days))
            sub_total += days
            sub_count += 1
            continue

    print('non-subscr,{},{},{}'.format(name, start, days))
    other_total += days
    other_count += 1


print('subscriber avg:', int(sub_total / sub_count))
print('non-subscr avg:', int(other_total / other_count))


