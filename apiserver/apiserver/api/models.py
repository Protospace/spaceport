from datetime import date, datetime
from django.db import models
from django.contrib.auth.models import User
from django.contrib.contenttypes.fields import GenericForeignKey
from django.contrib.contenttypes.models import ContentType
from django.utils.timezone import now, pytz
from simple_history.models import HistoricalRecords
from simple_history import register

register(User)

IGNORE = '+'

def today_alberta_tz():
    return datetime.now(pytz.timezone('America/Edmonton')).date()

class Member(models.Model):
    user = models.OneToOneField(User, related_name='member', blank=True, null=True, on_delete=models.SET_NULL)
    old_email = models.CharField(max_length=254, blank=True, null=True)
    photo_large = models.CharField(max_length=64, blank=True, null=True)
    photo_medium = models.CharField(max_length=64, blank=True, null=True)
    photo_small = models.CharField(max_length=64, blank=True, null=True)
    member_forms = models.CharField(max_length=64, blank=True, null=True)

    set_details = models.BooleanField(default=False)
    first_name = models.CharField(max_length=32)
    last_name = models.CharField(max_length=32)
    preferred_name = models.CharField(max_length=32)
    phone = models.CharField(default='', max_length=32, null=True)
    emergency_contact_name = models.CharField(max_length=64, blank=True)
    emergency_contact_phone = models.CharField(max_length=32, blank=True)
    birthdate = models.DateField(blank=True, null=True)
    is_minor = models.BooleanField(default=False)
    guardian_name = models.CharField(max_length=32, blank=True, null=True)
    street_address = models.CharField(default='', max_length=32, null=True)
    city = models.CharField(default='Calgary, AB', max_length=32)
    postal_code = models.CharField(max_length=16, null=True)

    is_director = models.BooleanField(default=False)
    is_staff = models.BooleanField(default=False)
    is_instructor = models.BooleanField(default=False)
    status = models.CharField(max_length=32, blank=True, null=True)
    expire_date = models.DateField(default=today_alberta_tz, null=True)
    current_start_date = models.DateField(default=today_alberta_tz, null=True)
    application_date = models.DateField(default=today_alberta_tz, null=True)
    vetted_date = models.DateField(blank=True, null=True)
    paused_date = models.DateField(blank=True, null=True)
    monthly_fees = models.IntegerField(default=55, blank=True, null=True)

    history = HistoricalRecords(excluded_fields=['member_forms'])

class Transaction(models.Model):
    user = models.ForeignKey(User, related_name='transactions', blank=True, null=True, on_delete=models.SET_NULL)
    recorder = models.ForeignKey(User, related_name=IGNORE, blank=True, null=True, on_delete=models.SET_NULL)

    member_id = models.IntegerField(blank=True, null=True)
    date = models.DateField(default=today_alberta_tz)
    amount = models.DecimalField(max_digits=7, decimal_places=2)
    reference_number = models.CharField(max_length=32, blank=True, null=True)
    memo = models.TextField(blank=True, null=True)
    number_of_membership_months = models.IntegerField(blank=True, null=True)
    payment_method = models.TextField(blank=True, null=True)
    category = models.TextField(blank=True, null=True)
    account_type = models.TextField(blank=True, null=True)
    info_source = models.TextField(blank=True, null=True)
    paypal_txn_id = models.CharField(max_length=17, blank=True, null=True)
    paypal_payer_id = models.CharField(max_length=13, blank=True, null=True)

    report_type = models.TextField(blank=True, null=True)
    report_memo = models.TextField(blank=True, null=True)

    history = HistoricalRecords()

class PayPalHint(models.Model):
    account = models.CharField(unique=True, max_length=13)
    member_id = models.IntegerField()

    history = HistoricalRecords()

class IPN(models.Model):
    datetime = models.DateTimeField(auto_now_add=True)
    data = models.TextField()
    status = models.CharField(max_length=32)

    history = HistoricalRecords()

class Card(models.Model):
    user = models.ForeignKey(User, related_name='cards', blank=True, null=True, on_delete=models.SET_NULL)

    member_id = models.IntegerField(blank=True, null=True)
    card_number = models.CharField(unique=True, max_length=16, blank=True, null=True)
    notes = models.TextField(blank=True, null=True)
    last_seen_at = models.DateField(default=today_alberta_tz, blank=True, null=True)
    active_status = models.CharField(max_length=32, blank=True, null=True)

    history = HistoricalRecords()

class Course(models.Model):
    name = models.TextField(blank=True, null=True)
    description = models.TextField(blank=True, null=True)
    is_old = models.BooleanField(default=False)

    history = HistoricalRecords()

class Session(models.Model):
    instructor = models.ForeignKey(User, related_name='teaching', blank=True, null=True, on_delete=models.SET_NULL)
    course = models.ForeignKey(Course, related_name='sessions', blank=True, null=True, on_delete=models.SET_NULL)

    is_cancelled = models.BooleanField(default=False)
    old_instructor = models.TextField(blank=True, null=True)
    datetime = models.DateTimeField(blank=True, null=True)
    cost = models.DecimalField(max_digits=5, decimal_places=2)
    max_students = models.IntegerField(blank=True, null=True)

    history = HistoricalRecords()

class Training(models.Model):
    user = models.ForeignKey(User, related_name='training', blank=True, null=True, on_delete=models.SET_NULL)
    session = models.ForeignKey(Session, related_name='students', blank=True, null=True, on_delete=models.SET_NULL)

    member_id = models.IntegerField(blank=True, null=True)
    attendance_status = models.TextField(blank=True, null=True)
    sign_up_date = models.DateField(default=today_alberta_tz, blank=True, null=True)
    paid_date = models.DateField(blank=True, null=True)

    history = HistoricalRecords()

class MetaInfo(models.Model):
    backup_id = models.TextField()

class HistoryIndex(models.Model):
    content_type = models.ForeignKey(ContentType, null=True, on_delete=models.SET_NULL)
    object_id = models.PositiveIntegerField()
    history = GenericForeignKey('content_type', 'object_id')

    owner_id = models.PositiveIntegerField()
    owner_name = models.TextField()
    object_name = models.TextField()
    history_user = models.ForeignKey(User, null=True, on_delete=models.SET_NULL)
    history_date = models.DateTimeField()
    history_type = models.TextField()
    revert_url = models.TextField()

    is_system = models.BooleanField()
    is_admin = models.BooleanField()

class HistoryChange(models.Model):
    index = models.ForeignKey(HistoryIndex, related_name='changes', null=True, on_delete=models.SET_NULL)

    field = models.TextField()
    old = models.TextField()
    new = models.TextField()
