from django.contrib.auth.models import User, Group
from rest_framework import serializers
from rest_framework.exceptions import ValidationError
from rest_auth.registration.serializers import RegisterSerializer

from . import models, old_models

GRAB_FIELDS = [
    'preferred_name',
    'phone',
    'current_start_date',
    'application_date',
    'vetted_date',
    'monthly_fees',
    'emergency_contact_name',
    'emergency_contact_phone',
]

#custom_error = lambda x: ValidationError(dict(non_field_errors=x))

class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'member']
        depth = 1


class MemberSerializer(serializers.ModelSerializer):
    class Meta:
        model = models.Member
        fields = '__all__'
        read_only_fields = ['user', 'application_date', 'current_start_date', 'vetted_date', 'monthly_fees', 'old_member_id']

class AdminMemberSerializer(serializers.ModelSerializer):
    class Meta:
        model = models.Member
        fields = '__all__'
        read_only_fields = ['id', 'user']


class RegistrationSerializer(RegisterSerializer):
    first_name = serializers.CharField(max_length=32)
    last_name = serializers.CharField(max_length=32)
    existing_member = serializers.ChoiceField(['true', 'false'])

    def custom_signup(self, request, user):
        data = request.data
        old_member_id = None
        old_member_fields = dict(preferred_name=data['first_name'])

        if data['existing_member'] == 'true':
            old_members = old_models.Members.objects.using('old_portal')
            try:
                old_member = old_members.get(email=data['email'])
            except old_models.Members.DoesNotExist:
                user.delete()
                raise ValidationError(dict(email='Unable to find in old database.'))

            old_member_id = old_member.id

            for f in GRAB_FIELDS:
                old_member_fields[f] = old_member.__dict__.get(f, None)

        models.Member.objects.create(
            user=user,
            first_name=data['first_name'],
            last_name=data['last_name'],
            old_member_id=old_member_id,
            **old_member_fields
        )
