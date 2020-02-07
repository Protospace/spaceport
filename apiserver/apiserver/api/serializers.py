from django.contrib.auth.models import User, Group
from django.shortcuts import get_object_or_404
from rest_framework import serializers
from rest_framework.exceptions import ValidationError
from rest_framework.validators import UniqueValidator
from rest_auth.registration.serializers import RegisterSerializer
from rest_auth.serializers import UserDetailsSerializer
import re

from . import models, fields, utils
from .. import settings

class TransactionSerializer(serializers.ModelSerializer):
    # fields directly from old portal. replace with slugs we want
    account_type = serializers.ChoiceField([
        'Interac',
        'TD Chequing',
        'Dream Pmt',
        'PayPal',
        'Square Pmt',
        'Member',
        'Clearing',
        'Cash'
    ])
    info_source = serializers.ChoiceField([
        'Web',
        'DB Edit',
        'System',
        'Receipt or Stmt',
        'Quicken Import',
        'PayPal IPN',
        'Auto',
        'Nexus DB Bulk',
        'IPN Trigger',
        'Intranet Receipt',
        'Automatic',
        'Manual'
    ])
    member_id = serializers.IntegerField()
    member_name = serializers.SerializerMethodField()
    date = serializers.DateField()
    report_type = serializers.ChoiceField([
        'Unmatched Member',
        'Unmatched Purchase',
        'User Flagged',
    ], allow_null=True, required=False)

    class Meta:
        model = models.Transaction
        fields = '__all__'
        read_only_fields = [
            'id',
            'last_seen_at',
            'user',
            'recorder',
            'paypal_txn_id',
            'paypal_payer_id',
        ]

    def create(self, validated_data):
        member = get_object_or_404(models.Member, id=validated_data['member_id'])
        if member.user:
            validated_data['user'] = member.user
        return super().create(validated_data)

    def update(self, instance, validated_data):
        member = get_object_or_404(models.Member, id=validated_data['member_id'])
        validated_data['user'] = member.user
        return super().update(instance, validated_data)

    def get_member_name(self, obj):
        if not obj.member_id: return 'Unknown'

        if obj.user:
            member = obj.user.member
        else:
            member = models.Member.objects.get(id=obj.member_id)
        return member.preferred_name + ' ' + member.last_name


# member viewing other members
class OtherMemberSerializer(serializers.ModelSerializer):
    status = serializers.SerializerMethodField()

    class Meta:
        model = models.Member
        fields = [
            'id',
            'preferred_name',
            'last_name',
            'status',
            'current_start_date',
            'photo_small',
            'photo_large'
        ]

    def get_status(self, obj):
        return 'Former Member' if obj.paused_date else obj.status

# member viewing his own details
class MemberSerializer(serializers.ModelSerializer):
    status = serializers.SerializerMethodField()
    photo = serializers.ImageField(write_only=True, required=False)
    email = fields.UserEmailField(serializers.EmailField)
    phone = serializers.CharField()
    street_address = serializers.CharField()
    city = serializers.CharField()
    postal_code = serializers.CharField()

    class Meta:
        model = models.Member
        fields = '__all__'
        read_only_fields = [
            'id',
            'is_director',
            'is_staff',
            'is_instructor',
            'first_name',
            'last_name',
            'status',
            'expire_date',
            'current_start_date',
            'application_date',
            'vetted_date',
            'paused_date',
            'monthly_fees',
            'photo_large',
            'photo_medium',
            'photo_small',
            'member_forms',
            'user',
            'old_email',
        ]

    def get_status(self, obj):
        return 'Former Member' if obj.paused_date else obj.status

    def update(self, instance, validated_data):
        if instance.user:
            instance.user.email = validated_data.get('email', instance.user.email)
            instance.user.save()
        else:
            instance.old_email = validated_data.get('email', instance.old_email)

        photo = validated_data.get('photo', None)
        if photo:
            small, medium, large = utils.process_image_upload(photo)
            instance.photo_small = small
            instance.photo_medium = medium
            instance.photo_large = large

        return super().update(instance, validated_data)

# admin viewing member details
class AdminMemberSerializer(MemberSerializer):
    class Meta:
        model = models.Member
        fields = '__all__'
        read_only_fields = [
            'id',
            'status',
            'expire_date',
            'paused_date',
            'photo_large',
            'photo_medium',
            'photo_small',
            'member_forms',
            'user',
            'old_email',
        ]


# member viewing member list or search result
class SearchSerializer(serializers.Serializer):
    q = serializers.CharField(write_only=True, max_length=64)
    seq = serializers.IntegerField(write_only=True)
    member = serializers.SerializerMethodField()

    def get_member(self, obj):
        serializer = OtherMemberSerializer(obj)
        return serializer.data

# admin viewing search result
class AdminSearchSerializer(serializers.Serializer):
    cards = serializers.SerializerMethodField()
    member = serializers.SerializerMethodField()
    transactions = serializers.SerializerMethodField()

    def get_member(self, obj):
        serializer = AdminMemberSerializer(obj)
        return serializer.data

    def get_cards(self, obj):
        if obj.user:
            queryset = obj.user.cards
        else:
            queryset = models.Card.objects.filter(member_id=obj.id)
        queryset = queryset.order_by('-last_seen_at')
        serializer = CardSerializer(data=queryset, many=True)
        serializer.is_valid()
        return serializer.data

    def get_transactions(self, obj):
        if obj.user:
            queryset = obj.user.transactions
        else:
            queryset = models.Transaction.objects.filter(member_id=obj.id)
        queryset = queryset.order_by('-id', '-date')
        serializer = TransactionSerializer(data=queryset, many=True)
        serializer.is_valid()
        return serializer.data


class CardSerializer(serializers.ModelSerializer):
    card_number = serializers.CharField(validators=[UniqueValidator(
        queryset=models.Card.objects.all(),
        message='Card number already exists.'
    )])
    member_id = serializers.IntegerField()
    active_status = serializers.ChoiceField([
        'card_blocked',
        'card_inactive',
        'card_member_blocked',
        'card_active'
    ])

    class Meta:
        model = models.Card
        fields = '__all__'
        read_only_fields = [
            'id',
            'last_seen_at',
            'user',
        ]

    def create(self, validated_data):
        member = get_object_or_404(models.Member, id=validated_data['member_id'])
        if member.user:
            validated_data['user'] = member.user
        return super().create(validated_data)


class TrainingSerializer(serializers.ModelSerializer):
    attendance_status = serializers.ChoiceField([
        'Waiting for payment',
        'Withdrawn',
        'Rescheduled',
        'No-show',
        'Attended',
        'Confirmed'
    ])
    session = serializers.PrimaryKeyRelatedField(queryset=models.Session.objects.all())
    student_name = serializers.SerializerMethodField()

    class Meta:
        model = models.Training
        fields = '__all__'
        read_only_fields = ['user', 'sign_up_date', 'paid_date', 'member_id']

    def get_student_name(self, obj):
        if obj.user:
            member = obj.user.member
        else:
            member = models.Member.objects.get(id=obj.member_id)
        return member.preferred_name + ' ' + member.last_name


class StudentTrainingSerializer(TrainingSerializer):
    attendance_status = serializers.ChoiceField(['Waiting for payment', 'Withdrawn'])


class SessionSerializer(serializers.ModelSerializer):
    student_count = serializers.SerializerMethodField()
    course_name = serializers.SerializerMethodField()
    instructor_name = serializers.SerializerMethodField()
    datetime = serializers.DateTimeField()
    course = serializers.PrimaryKeyRelatedField(queryset=models.Course.objects.all())
    students = TrainingSerializer(many=True, read_only=True)

    class Meta:
        model = models.Session
        fields = '__all__'
        read_only_fields = ['old_instructor', 'instructor']

    def get_student_count(self, obj):
        return len([x for x in obj.students.all() if x.attendance_status != 'Withdrawn'])

    def get_course_name(self, obj):
        return obj.course.name

    def get_instructor_name(self, obj):
        if obj.instructor and hasattr(obj.instructor, 'member'):
            name = '{} {}'.format(obj.instructor.member.preferred_name, obj.instructor.member.last_name[0])
        else:
            name = 'Unknown'
        return obj.old_instructor or name

class SessionListSerializer(SessionSerializer):
    students = None


class CourseSerializer(serializers.ModelSerializer):
    class Meta:
        model = models.Course
        fields = ['id', 'name']

class CourseDetailSerializer(serializers.ModelSerializer):
    sessions = SessionListSerializer(many=True, read_only=True)
    name = serializers.CharField(max_length=100)
    description = fields.HTMLField(max_length=6000)
    class Meta:
        model = models.Course
        fields = '__all__'


class UserTrainingSerializer(serializers.ModelSerializer):
    session = SessionListSerializer()
    class Meta:
        model = models.Training
        exclude = ['user']
        depth = 2

class UserSerializer(serializers.ModelSerializer):
    training = UserTrainingSerializer(many=True)
    member = MemberSerializer()
    transactions = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            'id',
            'username',
            'member',
            'transactions',
            'cards',
            'training',
            'is_staff'
        ]
        depth = 1

    def get_transactions(self, obj):
        queryset = models.Transaction.objects.filter(user=obj)
        queryset = queryset.exclude(category='Memberships:Fake Months')
        queryset = queryset.order_by('-id', '-date')
        serializer = TransactionSerializer(data=queryset, many=True)
        serializer.is_valid()
        return serializer.data


class RegistrationSerializer(RegisterSerializer):
    first_name = serializers.CharField(max_length=32)
    last_name = serializers.CharField(max_length=32)
    existing_member = serializers.ChoiceField(['true', 'false'])

    def validate_username(self, username):
        if re.search(r'[^a-z.]', username):
            raise ValidationError('Invalid characters.')
        return super().validate_username(username)

    def custom_signup(self, request, user):
        data = request.data

        is_test_signup = bool(data['last_name'] == 'tester')

        if not utils.is_request_from_protospace(request) and not is_test_signup:
            user.delete()
            raise ValidationError(dict(non_field_errors='Can only register from Protospace.'))

        if data['existing_member'] == 'true':
            utils.link_old_member(data, user)
        else:
            models.Member.objects.create(
                user=user,
                first_name=data['first_name'],
                last_name=data['last_name'],
                preferred_name=data['first_name'],
            )
