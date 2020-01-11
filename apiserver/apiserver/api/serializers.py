from django.contrib.auth.models import User, Group
from rest_framework import serializers
from rest_framework.exceptions import ValidationError
from rest_auth.registration.serializers import RegisterSerializer

from . import models, old_models

#custom_error = lambda x: ValidationError(dict(non_field_errors=x))

class UserTrainingSerializer(serializers.ModelSerializer):
    class Meta:
        model = models.Training
        exclude = ['user']
        depth = 2

class UserSerializer(serializers.ModelSerializer):
    training = UserTrainingSerializer(many=True)

    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'member', 'transactions', 'cards', 'training']
        depth = 1


# member viewing member list or other member
class OtherMemberSerializer(serializers.ModelSerializer):
    q = serializers.CharField(write_only=True, max_length=64)
    seq = serializers.IntegerField(write_only=True, )

    class Meta:
        model = models.Member
        fields = ['q', 'seq', 'preferred_name', 'last_name', 'status', 'current_start_date']

# member viewing himself
class MemberSerializer(serializers.ModelSerializer):
    class Meta:
        model = models.Member
        fields = '__all__'
        read_only_fields = ['user', 'application_date', 'current_start_date', 'vetted_date', 'monthly_fees', 'old_member_id']

# adming viewing member
class AdminMemberSerializer(serializers.ModelSerializer):
    class Meta:
        model = models.Member
        fields = '__all__'
        read_only_fields = ['id', 'user']


class TransactionSerializer(serializers.ModelSerializer):
    class Meta:
        model = models.Transaction
        fields = '__all__'


class SessionDetailSerializer(serializers.ModelSerializer):
    class Meta:
        model = models.Training
        exclude = ['user']

class SessionSerializer(serializers.ModelSerializer):
    student_count = serializers.SerializerMethodField()
    class Meta:
        model = models.Session
        fields = '__all__'
        depth = 1
    def get_student_count(self, obj):
        return len(obj.students.all())


class CourseSerializer(serializers.ModelSerializer):
    class Meta:
        model = models.Course
        fields = '__all__'

class CourseDetailSerializer(serializers.ModelSerializer):
    sessions = SessionSerializer(many=True)

    class Meta:
        model = models.Course
        fields = '__all__'
        depth = 1

class AdminCourseSerializer(serializers.ModelSerializer):
    class Meta:
        model = models.Course
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
                raise ValidationError(dict(email='Unable to find email in old database.'))

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

            training = models.Training.objects.filter(member_id=member.id)
            for t in training:
                t.user = user
                t.save()

        else:
            models.Member.objects.create(
                user=user,
                first_name=data['first_name'],
                last_name=data['last_name'],
                preferred_name=data['first_name'],
            )
