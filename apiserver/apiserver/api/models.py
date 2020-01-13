from datetime import date
from django.db import models
from django.contrib.auth.models import User
from django.utils.timezone import now

from . import old_models

class Member(models.Model):
    user = models.OneToOneField(User, blank=True, null=True, on_delete=models.SET_NULL)
    photo_large = models.CharField(max_length=64, blank=True, null=True)
    photo_medium = models.CharField(max_length=64, blank=True, null=True)
    photo_small = models.CharField(max_length=64, blank=True, null=True)

    set_details = models.BooleanField(default=False)
    first_name = models.CharField(max_length=32)
    last_name = models.CharField(max_length=32)
    preferred_name = models.CharField(max_length=32)
    phone = models.CharField(max_length=32, null=True)
    emergency_contact_name = models.CharField(max_length=64, blank=True)
    emergency_contact_phone = models.CharField(max_length=32, blank=True)
    birthdate = models.DateField(blank=True, null=True)
    is_minor = models.BooleanField(default=False)
    guardian_name = models.CharField(max_length=32, blank=True, null=True)
    street_address = models.CharField(max_length=32, null=True)
    city = models.CharField(default='Calgary, AB', max_length=32)
    postal_code = models.CharField(max_length=16, null=True)

    is_director = models.BooleanField(default=False)
    is_instructor = models.BooleanField(default=False)
    status = models.CharField(max_length=32, blank=True, null=True)
    expire_date = models.DateField(default=date.today, null=True)
    current_start_date = models.DateField(default=date.today, null=True)
    application_date = models.DateField(default=date.today, null=True)
    vetted_date = models.DateField(blank=True, null=True)
    monthly_fees = models.IntegerField(default=55, blank=True, null=True)

class Transaction(models.Model):
    user = models.ForeignKey(User, related_name='transactions', blank=True, null=True, on_delete=models.SET_NULL)
    recorder = models.ForeignKey(User, related_name='+', blank=True, null=True, on_delete=models.SET_NULL)

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

class Card(models.Model):
    user = models.ForeignKey(User, related_name='cards', blank=True, null=True, on_delete=models.SET_NULL)

    member_id = models.IntegerField(blank=True, null=True)
    card_number = models.CharField(max_length=16, blank=True, null=True)
    notes = models.TextField(blank=True, null=True)
    last_seen_at = models.DateField(default=date.today, blank=True, null=True)
    active_status = models.CharField(max_length=32, blank=True, null=True)

class Course(models.Model):
    name = models.TextField(blank=True, null=True)
    description = models.TextField(blank=True, null=True)
    is_old = models.BooleanField(default=False)

class Session(models.Model):
    instructor = models.ForeignKey(User, related_name='teaching', blank=True, null=True, on_delete=models.SET_NULL)
    course = models.ForeignKey(Course, related_name='sessions', blank=True, null=True, on_delete=models.SET_NULL)

    old_instructor = models.TextField(blank=True, null=True)
    datetime = models.DateTimeField(blank=True, null=True)
    cost = models.DecimalField(max_digits=5, decimal_places=2)

class Training(models.Model):
    user = models.ForeignKey(User, related_name='training', blank=True, null=True, on_delete=models.SET_NULL)
    session = models.ForeignKey(Session, related_name='students', blank=True, null=True, on_delete=models.SET_NULL)

    member_id = models.IntegerField(blank=True, null=True)
    attendance_status = models.TextField(blank=True, null=True)
    sign_up_date = models.DateField(default=date.today, blank=True, null=True)
    paid_date = models.DateField(default=date.today, blank=True, null=True)
