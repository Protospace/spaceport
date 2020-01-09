from django.contrib.auth.models import User, Group
from rest_framework import serializers
from rest_framework.exceptions import ValidationError
from rest_auth.registration.serializers import RegisterSerializer

from . import models, old_models

#custom_error = lambda x: ValidationError(dict(non_field_errors=x))

class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'member', 'transactions', 'cards']
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


class TransactionSerializer(serializers.ModelSerializer):
    class Meta:
        model = models.Transaction
        fields = '__all__'


class RegistrationSerializer(RegisterSerializer):
    first_name = serializers.CharField(max_length=32)
    last_name = serializers.CharField(max_length=32)
    existing_member = serializers.ChoiceField(['true', 'false'])

    def custom_signup(self, request, user):
        data = request.data

        if data['existing_member'] == 'true':
            old_members = old_models.Members.objects.using('old_portal')
            try:
                old_member = old_members.get(email=data['email'])
            except old_models.Members.DoesNotExist:
                user.delete()
                raise ValidationError(dict(email='Unable to find in old database.'))

            member = models.Member.objects.get(id=old_member.id)

            if member.user:
                raise ValidationError(dict(email='Old member already claimed.'))

            member.user = user
            member.first_name = data['first_name']
            member.last_name = data['last_name']
            member.preferred_name = data['first_name']
            member.save()

            transactions = models.Transaction.objects.filter(member_id=member.id)
            for t in transactions:
                t.user = user
                t.save()

            cards = models.Card.objects.filter(member_id=member.id)
            for c in cards:
                c.user = user
                c.save()

        else:
            models.Member.objects.create(
                user=user,
                first_name=data['first_name'],
                last_name=data['last_name'],
                preferred_name=data['first_name'],
            )
