from datetime import date, datetime
from django.db import models
from django.contrib.auth.models import User
from django.contrib.contenttypes.fields import GenericForeignKey
from django.contrib.contenttypes.models import ContentType
from django.utils.timezone import now, pytz
from simple_history.models import HistoricalRecords
from simple_history import register

TIMEZONE_CALGARY = pytz.timezone('America/Edmonton')

register(User)

IGNORE = '+'

def today_alberta_tz():
    return datetime.now(TIMEZONE_CALGARY).date()

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
    emergency_contact_name = models.CharField(default='', max_length=64, blank=True)
    emergency_contact_phone = models.CharField(default='', max_length=32, blank=True)
    birthdate = models.DateField(blank=True, null=True)
    is_minor = models.BooleanField(default=False)
    guardian_name = models.CharField(max_length=32, blank=True, null=True)
    public_bio = models.CharField(max_length=512, blank=True)
    private_notes = models.CharField(max_length=512, blank=True)

    is_director = models.BooleanField(default=False)
    is_staff = models.BooleanField(default=False)
    is_instructor = models.BooleanField(default=False)
    status = models.CharField(max_length=32, blank=True, null=True)
    expire_date = models.DateField(default=today_alberta_tz, null=True)
    current_start_date = models.DateField(default=today_alberta_tz, null=True)
    application_date = models.DateField(default=today_alberta_tz, null=True)
    vetted_date = models.DateField(blank=True, null=True)
    orientation_date = models.DateField(blank=True, null=True, default=None)
    lathe_cert_date = models.DateField(blank=True, null=True, default=None)
    mill_cert_date = models.DateField(blank=True, null=True, default=None)
    wood_cert_date = models.DateField(blank=True, null=True, default=None)
    wood2_cert_date = models.DateField(blank=True, null=True, default=None)
    tormach_cnc_cert_date = models.DateField(blank=True, null=True, default=None)
    precix_cnc_cert_date = models.DateField(blank=True, null=True, default=None)
    rabbit_cert_date = models.DateField(blank=True, null=True, default=None)
    trotec_cert_date = models.DateField(blank=True, null=True, default=None)
    paused_date = models.DateField(blank=True, null=True)
    monthly_fees = models.IntegerField(default=55, blank=True, null=True)
    is_allowed_entry = models.BooleanField(default=True)
    discourse_username = models.CharField(default='', max_length=40, blank=True, null=True)
    mediawiki_username = models.CharField(default='', max_length=40, blank=True, null=True)
    allow_last_scanned = models.BooleanField(default=True)

    history = HistoricalRecords(excluded_fields=['member_forms'])

    list_display = ['user', 'preferred_name', 'last_name', 'status']
    search_fields = ['user__username', 'preferred_name', 'last_name', 'status']
    def __str__(self):
        return getattr(self.user, 'username', 'None')

class Transaction(models.Model):
    user = models.ForeignKey(User, related_name='transactions', blank=True, null=True, on_delete=models.SET_NULL)
    recorder = models.ForeignKey(User, related_name=IGNORE, blank=True, null=True, on_delete=models.SET_NULL)

    member_id = models.IntegerField(blank=True, null=True)
    date = models.DateField(default=today_alberta_tz)
    amount = models.DecimalField(max_digits=7, decimal_places=2)
    reference_number = models.CharField(max_length=64, blank=True, null=True)
    memo = models.TextField(blank=True, null=True)
    number_of_membership_months = models.IntegerField(blank=True, null=True)
    payment_method = models.TextField(blank=True, null=True)
    category = models.TextField(blank=True, null=True)
    account_type = models.TextField(blank=True, null=True)
    info_source = models.TextField(blank=True, null=True)
    paypal_txn_id = models.CharField(max_length=17, blank=True, null=True, unique=True)
    paypal_txn_type = models.CharField(max_length=64, blank=True, null=True)
    paypal_payer_id = models.CharField(max_length=13, blank=True, null=True)
    protocoin = models.DecimalField(max_digits=7, decimal_places=2, default=0)

    report_type = models.TextField(blank=True, null=True)
    report_memo = models.TextField(blank=True, null=True)

    history = HistoricalRecords()

    list_display = ['date', 'user', 'amount', 'protocoin', 'account_type', 'category']
    search_fields = ['date', 'user__username', 'account_type', 'category']
    def __str__(self):
        return '%s tx %s' % (user.username, date)

class PayPalHint(models.Model):
    user = models.ForeignKey(User, related_name='paypal_hints', blank=True, null=True, on_delete=models.SET_NULL)

    account = models.CharField(unique=True, max_length=13)
    member_id = models.IntegerField(null=True)

    history = HistoricalRecords()

    list_display = ['account', 'user']
    search_fields = ['account', 'user__username']
    def __str__(self):
        return self.account

class IPN(models.Model):
    datetime = models.DateTimeField(auto_now_add=True)
    data = models.TextField()
    status = models.CharField(max_length=32)

    history = HistoricalRecords()

    list_display = ['datetime', 'status']
    search_fields = ['datetime', 'status']
    def __str__(self):
        return self.datetime

class Card(models.Model):
    user = models.ForeignKey(User, related_name='cards', blank=True, null=True, on_delete=models.SET_NULL)

    member_id = models.IntegerField(blank=True, null=True)
    card_number = models.CharField(unique=True, max_length=16, blank=True, null=True)
    notes = models.TextField(blank=True, null=True)
    last_seen_at = models.DateField(blank=True, null=True)
    last_seen = models.DateTimeField(blank=True, null=True)
    active_status = models.CharField(max_length=32, blank=True, null=True)

    history = HistoricalRecords(excluded_fields=['last_seen_at', 'last_seen'])

    list_display = ['card_number', 'user', 'last_seen']
    search_fields = ['card_number', 'user__username', 'last_seen']
    def __str__(self):
        return self.card_number

class Course(models.Model):
    name = models.TextField(blank=True, null=True)
    description = models.TextField(blank=True, null=True)
    is_old = models.BooleanField(default=False)
    tags = models.CharField(max_length=128, blank=True)

    history = HistoricalRecords()

    list_display = ['name', 'id']
    search_fields = ['name', 'id']
    def __str__(self):
        return self.name

class Session(models.Model):
    instructor = models.ForeignKey(User, related_name='teaching', blank=True, null=True, on_delete=models.SET_NULL)
    course = models.ForeignKey(Course, related_name='sessions', blank=True, null=True, on_delete=models.SET_NULL)

    is_cancelled = models.BooleanField(default=False)
    old_instructor = models.TextField(blank=True, null=True)
    datetime = models.DateTimeField(blank=True, null=True)
    cost = models.DecimalField(max_digits=5, decimal_places=2)
    max_students = models.IntegerField(blank=True, null=True)

    history = HistoricalRecords()

    list_display = ['datetime', 'course', 'instructor']
    search_fields = ['datetime', 'course__name', 'instructor__username']
    def __str__(self):
        return '%s @ %s' % (self.course.name, self.datetime.astimezone(TIMEZONE_CALGARY).strftime('%Y-%m-%d %-I:%M %p'))

class Training(models.Model):
    user = models.ForeignKey(User, related_name='training', blank=True, null=True, on_delete=models.SET_NULL)
    session = models.ForeignKey(Session, related_name='students', blank=True, null=True, on_delete=models.SET_NULL)

    member_id = models.IntegerField(blank=True, null=True)
    attendance_status = models.TextField(blank=True, null=True)
    sign_up_date = models.DateField(default=today_alberta_tz, blank=True, null=True)
    paid_date = models.DateField(blank=True, null=True)

    history = HistoricalRecords()

    list_display = ['session', 'user']
    search_fields = ['session__course__name', 'user__username']
    def __str__(self):
        return '%s taking %s @ %s' % (self.user, self.session.course.name, self.session.datetime)

class Interest(models.Model):
    user = models.ForeignKey(User, related_name='interests', null=True, on_delete=models.SET_NULL)
    course = models.ForeignKey(Course, related_name='interests', null=True, on_delete=models.SET_NULL)

    satisfied_by = models.ForeignKey(Session, related_name='satisfies', null=True, on_delete=models.SET_NULL)

    list_display = ['user', 'course', 'satisfied_by']
    search_fields = ['user__username', 'course__name']
    def __str__(self):
        return '%s interested in %s' % (self.user, self.course)


class MetaInfo(models.Model):
    backup_id = models.TextField()

class StatsMemberCount(models.Model):
    date = models.DateField(default=today_alberta_tz)
    member_count = models.IntegerField()
    green_count = models.IntegerField()
    six_month_plus_count = models.IntegerField()
    vetted_count = models.IntegerField()
    subscriber_count = models.IntegerField()

    list_display = ['date', 'member_count', 'green_count', 'six_month_plus_count', 'vetted_count', 'subscriber_count']
    search_fields = ['date', 'member_count', 'green_count', 'six_month_plus_count', 'vetted_count', 'subscriber_count']

class StatsSignupCount(models.Model):
    month = models.DateField()
    signup_count = models.IntegerField()
    retain_count = models.IntegerField(default=0)
    vetted_count = models.IntegerField(default=0)

    list_display = ['month', 'signup_count', 'retain_count', 'vetted_count']
    search_fields = ['month', 'signup_count', 'retain_count', 'vetted_count']

class StatsSpaceActivity(models.Model):
    date = models.DateField(default=today_alberta_tz)
    card_scans = models.IntegerField()

    list_display = ['date', 'card_scans']
    search_fields = ['date', 'card_scans']

class Usage(models.Model):
    user = models.ForeignKey(User, related_name='usages', blank=True, null=True, on_delete=models.SET_NULL)

    username = models.CharField(max_length=64, blank=True)  # incase of LDAP-Spaceport mismatch

    device = models.CharField(max_length=64)
    started_at = models.DateTimeField(auto_now_add=True)
    finished_at = models.DateTimeField(null=True)
    deleted_at = models.DateTimeField(null=True, blank=True)

    num_seconds = models.IntegerField()
    num_reports = models.IntegerField()
    memo = models.TextField(blank=True)
    should_bill = models.BooleanField(default=True)

    history = HistoricalRecords(excluded_fields=['num_reports'])

    list_display = ['started_at', 'finished_at', 'user', 'num_seconds', 'should_bill']
    search_fields = ['started_at', 'finished_at', 'user__username']
    def __str__(self):
        return str(self.started_at)

class PinballScore(models.Model):
    user = models.ForeignKey(User, related_name='scores', blank=True, null=True, on_delete=models.SET_NULL)

    started_at = models.DateTimeField(auto_now_add=True)
    finished_at = models.DateTimeField(null=True)

    game_id = models.IntegerField()
    player = models.IntegerField()
    score = models.IntegerField()

    # no history

    list_display = ['started_at', 'game_id', 'player', 'score', 'user']
    search_fields = ['started_at', 'game_id', 'player', 'score', 'user__username']
    def __str__(self):
        return str(self.started_at)

class Hosting(models.Model):
    user = models.ForeignKey(User, related_name='hosting', blank=True, null=True, on_delete=models.SET_NULL)

    started_at = models.DateTimeField(auto_now_add=True)
    finished_at = models.DateTimeField()
    hours = models.DecimalField(max_digits=5, decimal_places=2)

    # no history

    list_display = ['started_at', 'hours', 'finished_at', 'user']
    search_fields = ['started_at', 'hours', 'finished_at', 'user__username']
    def __str__(self):
        return str(self.started_at)

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

    list_display = ['history_date', 'history_user', 'history_type', 'owner_name', 'object_name']
    search_fields = ['history_date', 'history_user__username', 'history_type', 'owner_name', 'object_name']
    def __str__(self):
        return '%s changed %s\'s %s' % (self.history_user, self.owner_name, self.object_name)

class HistoryChange(models.Model):
    index = models.ForeignKey(HistoryIndex, related_name='changes', null=True, on_delete=models.SET_NULL)

    field = models.TextField()
    old = models.TextField()
    new = models.TextField()

    list_display = ['field', 'old', 'new', 'index']
    search_fields = ['field', 'old', 'new', 'index__history_user__username']
    def __str__(self):
        return self.field
