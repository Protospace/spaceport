from datetime import date
from django.db import models
from django.contrib.auth.models import User
from django.utils.timezone import now

from . import old_models

class Member(models.Model):
    user = models.OneToOneField(User, blank=True, null=True, on_delete=models.PROTECT)
    first_name = models.CharField(max_length=32)
    last_name = models.CharField(max_length=32)

    set_details = models.BooleanField(default=False)
    preferred_name = models.CharField(max_length=32, blank=True)
    phone = models.CharField(max_length=32, blank=True)
    current_start_date = models.DateField(default=date.today, blank=True, null=True)
    application_date = models.DateField(default=date.today, blank=True, null=True)
    vetted_date = models.DateField(blank=True, null=True)
    monthly_fees = models.IntegerField(default=55, blank=True, null=True)
    emergency_contact_name = models.CharField(max_length=64, blank=True)
    emergency_contact_phone = models.CharField(max_length=32, blank=True)

class Transaction(models.Model):
    user = models.ForeignKey(User, related_name='transactions', blank=True, null=True, on_delete=models.PROTECT)
    recorder = models.ForeignKey(User, related_name='+', blank=True, null=True, on_delete=models.PROTECT)

    member_id = models.IntegerField(blank=True, null=True)
    date = models.DateField(default=date.today)
    amount = models.DecimalField(max_digits=7, decimal_places=2)
    reference_number = models.CharField(max_length=32, blank=True, null=True)
    memo = models.TextField(blank=True, null=True)
    number_of_membership_months = models.TextField(blank=True, null=True)
    payment_method = models.TextField(blank=True, null=True)
    category = models.TextField(blank=True, null=True)
    account_type = models.TextField(blank=True, null=True)
    info_source = models.TextField(blank=True, null=True)
