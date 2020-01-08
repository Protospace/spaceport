from django.db import models
from django.contrib.auth.models import User

from . import old_models

class Member(models.Model):
    user = models.OneToOneField(User, on_delete=models.PROTECT)
    first_name = models.CharField(max_length=32)
    last_name = models.CharField(max_length=32)
    old_member_id = models.IntegerField(null=True, blank=True)

    set_details = models.BooleanField(default=False)
    preferred_name = models.CharField(max_length=32, blank=True)
    phone = models.CharField(max_length=32, blank=True)
    current_start_date = models.DateField(blank=True, null=True)
    application_date = models.DateField(blank=True, null=True)
    vetted_date = models.DateField(blank=True, null=True)
    monthly_fees = models.IntegerField(blank=True, null=True)
    emergency_contact_name = models.CharField(max_length=64, blank=True)
    emergency_contact_phone = models.CharField(max_length=32, blank=True)
