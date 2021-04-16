import logging
logger = logging.getLogger(__name__)

from django.contrib.auth.models import User, Group
from django.shortcuts import get_object_or_404
from rest_framework import serializers
from rest_framework.exceptions import ValidationError
from rest_framework.validators import UniqueValidator
from rest_auth.registration.serializers import RegisterSerializer
from rest_auth.serializers import PasswordChangeSerializer, PasswordResetSerializer, PasswordResetConfirmSerializer, LoginSerializer
from rest_auth.serializers import UserDetailsSerializer
import re

from . import models, fields, utils, utils_ldap, utils_auth
from .. import settings, secrets

class UsageSerializer(serializers.ModelSerializer):
    class Meta:
        model = models.UsageTrack
        fields = '__all__'

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
        'Cash',
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
        'Manual',
    ])
    category = serializers.ChoiceField([
        'Membership',
        'OnAcct',
        'Snacks',
        'Donation',
        'Consumables',
        'Purchases',
        'Garage Sale',
        'Reimburse',
        'Other',
    ])
    member_id = serializers.IntegerField()
    member_name = serializers.SerializerMethodField()
    date = serializers.DateField()
    report_type = serializers.ChoiceField([
        'Unmatched Member',
        'Unmatched Purchase',
        'User Flagged',
    ], allow_null=True, required=False)
    number_of_membership_months = serializers.IntegerField(max_value=36, min_value=-36)

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
            'application_date',
            'photo_small',
            'photo_large',
            'public_bio',
        ]

    def get_status(self, obj):
        return 'Former Member' if obj.paused_date else obj.status


# member viewing his own details
class MemberSerializer(serializers.ModelSerializer):
    status = serializers.SerializerMethodField()
    photo = serializers.ImageField(write_only=True, required=False)
    crop = serializers.CharField(write_only=True, required=False)
    email = fields.UserEmailField(serializers.EmailField)
    phone = serializers.CharField()
    street_address = serializers.CharField(required=False)
    city = serializers.CharField(required=False)
    postal_code = serializers.CharField(required=False)

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
            'card_photo',
            'user',
            'old_email',
            'orientation_date',
            'lathe_cert_date',
            'mill_cert_date',
            'wood_cert_date',
            'wood2_cert_date',
            'cnc_cert_date',
            'rabbit_cert_date',
            'trotec_cert_date',
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
        crop = validated_data.get('crop', None)
        if photo:
            small, medium, large = utils.process_image_upload(photo, crop)
            instance.photo_small = small
            instance.photo_medium = medium
            instance.photo_large = large

        return super().update(instance, validated_data)

# admin viewing member details
class AdminMemberSerializer(MemberSerializer):
    phone = serializers.CharField(required=False)
    street_address = serializers.CharField(required=False)
    city = serializers.CharField(required=False)
    postal_code = serializers.CharField(required=False)
    monthly_fees = serializers.ChoiceField([10, 30, 35, 50, 55])

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
            'card_photo',
            'user',
            'old_email',
            'is_director',
            'is_staff',
        ]

    def update(self, instance, validated_data):
        if 'rabbit_cert_date' in validated_data:
            changed = validated_data['rabbit_cert_date'] != instance.rabbit_cert_date
            if changed:
                if validated_data['rabbit_cert_date']:
                    utils_ldap.add_to_group(instance, 'Laser Users')
                else:
                    utils_ldap.remove_from_group(instance, 'Laser Users')

        if 'trotec_cert_date' in validated_data:
            changed = validated_data['trotec_cert_date'] != instance.trotec_cert_date
            if changed:
                if validated_data['trotec_cert_date']:
                    utils_ldap.add_to_group(instance, 'Trotec Users')
                else:
                    utils_ldap.remove_from_group(instance, 'Trotec Users')

        return super().update(instance, validated_data)


# member viewing member list or search result
class SearchSerializer(serializers.Serializer):
    q = serializers.CharField(write_only=True, max_length=64)
    seq = serializers.IntegerField(write_only=True)
    member = serializers.SerializerMethodField()

    def get_member(self, obj):
        serializer = OtherMemberSerializer(obj)
        return serializer.data

# instructor viewing search result
class InstructorSearchSerializer(serializers.Serializer):
    member = serializers.SerializerMethodField()
    training = serializers.SerializerMethodField()

    def get_member(self, obj):
        serializer = OtherMemberSerializer(obj)
        return serializer.data

    def get_training(self, obj):
        if obj.user:
            queryset = obj.user.training
        else:
            queryset = models.Training.objects.filter(member_id=obj.id)
        serializer = UserTrainingSerializer(data=queryset, many=True)
        serializer.is_valid()
        return serializer.data

# admin viewing search result
class AdminSearchSerializer(serializers.Serializer):
    cards = serializers.SerializerMethodField()
    member = serializers.SerializerMethodField()
    training = serializers.SerializerMethodField()
    transactions = serializers.SerializerMethodField()
    usages = serializers.SerializerMethodField()

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

    def get_training(self, obj):
        if obj.user:
            queryset = obj.user.training
        else:
            queryset = models.Training.objects.filter(member_id=obj.id)
        serializer = UserTrainingSerializer(data=queryset, many=True)
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

    def get_usages(self, obj):
        if obj.user:
            queryset = obj.user.usages.order_by('-start_time')
        else:
            queryset = []
        serializer = UsageSerializer(data=queryset, many=True)
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

        if not member.vetted_date:
            raise ValidationError(dict(non_field_errors='Member not vetted yet.'))
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
    student_email = serializers.SerializerMethodField()
    student_id = serializers.SerializerMethodField()

    class Meta:
        model = models.Training
        fields = '__all__'
        read_only_fields = ['user', 'sign_up_date', 'paid_date']

    def get_student_name(self, obj):
        if obj.user:
            member = obj.user.member
        else:
            member = models.Member.objects.get(id=obj.member_id)
        return member.preferred_name + ' ' + member.last_name

    def get_student_email(self, obj):
        if obj.user:
            return obj.user.email
        else:
            member = models.Member.objects.get(id=obj.member_id)
            return member.old_email

    def get_student_id(self, obj):
        if obj.user:
            return obj.user.member.id
        else:
            return obj.member_id


class StudentTrainingSerializer(TrainingSerializer):
    attendance_status = serializers.ChoiceField(['Waiting for payment', 'Withdrawn'])


class SessionSerializer(serializers.ModelSerializer):
    student_count = serializers.SerializerMethodField()
    course_name = serializers.SerializerMethodField()
    instructor_name = serializers.SerializerMethodField()
    datetime = serializers.DateTimeField()
    course = serializers.PrimaryKeyRelatedField(queryset=models.Course.objects.all())
    students = TrainingSerializer(many=True, read_only=True)
    max_students = serializers.IntegerField(min_value=1, max_value=50, allow_null=True)
    cost = serializers.DecimalField(max_digits=None, decimal_places=2, min_value=0, max_value=200)

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
    door_code = serializers.SerializerMethodField()
    wifi_pass = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            'id',
            'username',
            'member',
            'transactions',
            'cards',
            'training',
            'is_staff',
            'door_code',
            'wifi_pass',
            'usages',
        ]
        depth = 1

    def get_transactions(self, obj):
        queryset = models.Transaction.objects.filter(user=obj)
        queryset = queryset.exclude(category='Memberships:Fake Months')
        queryset = queryset.order_by('-id', '-date')
        serializer = TransactionSerializer(data=queryset, many=True)
        serializer.is_valid()
        return serializer.data

    def get_door_code(self, obj):
        if not obj.member.paused_date and obj.cards.count():
            return secrets.DOOR_CODE
        else:
            return None

    def get_wifi_pass(self, obj):
        if not obj.member.paused_date:
            return secrets.WIFI_PASS
        else:
            return None


class MyRegisterSerializer(RegisterSerializer):
    first_name = serializers.CharField(max_length=32)
    last_name = serializers.CharField(max_length=32)
    existing_member = serializers.ChoiceField(['true', 'false'])

    def validate_username(self, username):
        if re.search(r'[^a-z.]', username):
            raise ValidationError('Invalid characters.')
        if '..' in username:
            raise ValidationError('Can\'t have double periods.')
        if username.startswith('.') or username.endswith('.'):
            raise ValidationError('Can\'t start or end with periods.')
        return super().validate_username(username)

    def custom_signup(self, request, user):
        data = request.data

        if secrets.REGISTRATION_BYPASS:
            bypass_code = data.get('bypass_code', None)
            allow_bypass = secrets.REGISTRATION_BYPASS == bypass_code
        else:
            allow_bypass = False

        if not allow_bypass and not utils.is_request_from_protospace(request):
            logger.info('Request not from protospace')
            user.delete()
            raise ValidationError(dict(non_field_errors='Can only register from Protospace.'))

        utils.register_user(data, user)

class MyPasswordChangeSerializer(PasswordChangeSerializer):
    def save(self):
        data = dict(
            username=self.user.username,
            password1=self.request.data['new_password1'],
        )

        if utils_ldap.is_configured():
            if utils_ldap.set_password(data) != 200:
                msg = 'Problem connecting to LDAP server: set.'
                utils.alert_tanner(msg)
                logger.info(msg)
                raise ValidationError(dict(non_field_errors=msg))

        data = dict(
            username=self.user.username,
            password=self.data['new_password1'],
        )

        if utils_auth.is_configured():
            if utils_auth.set_password(data) != 200:
                msg = 'Problem connecting to Auth server: set.'
                utils.alert_tanner(msg)
                logger.info(msg)
                raise ValidationError(dict(non_field_errors=msg))

        super().save()

class MyPasswordResetSerializer(PasswordResetSerializer):
    def validate_email(self, email):
        if not User.objects.filter(email__iexact=email).exists():
            logging.info('Email not found: ' + email)
            raise ValidationError('Not found.')
        return super().validate_email(email)

    def save(self):
        email = self.data['email']
        member = User.objects.get(email__iexact=email).member
        logging.info('Password reset requested for: {} - {} {} ({})'.format(email, member.first_name, member.last_name, member.id))
        super().save()

class MyPasswordResetConfirmSerializer(PasswordResetConfirmSerializer):
    def save(self):
        data = dict(
            username=self.user.username,
            password1=self.data['new_password1'],
        )

        if utils_ldap.is_configured():
            if utils_ldap.set_password(data) != 200:
                msg = 'Problem connecting to LDAP server: set.'
                utils.alert_tanner(msg)
                logger.info(msg)
                raise ValidationError(dict(non_field_errors=msg))

        data = dict(
            username=self.user.username,
            password=self.data['new_password1'],
        )

        if utils_auth.is_configured():
            if utils_auth.set_password(data) != 200:
                msg = 'Problem connecting to Auth server: set.'
                utils.alert_tanner(msg)
                logger.info(msg)
                raise ValidationError(dict(non_field_errors=msg))

        member = self.user.member
        logging.info('Password reset completed for: {} {} ({})'.format(member.first_name, member.last_name, member.id))

        super().save()


class MemberCountSerializer(serializers.ModelSerializer):
    class Meta:
        model = models.StatsMemberCount
        fields = '__all__'

class SignupCountSerializer(serializers.ModelSerializer):
    month = serializers.SerializerMethodField()

    class Meta:
        model = models.StatsSignupCount
        fields = '__all__'

    def get_month(self, obj):
        return str(obj.month)[:7]

class SpaceActivitySerializer(serializers.ModelSerializer):
    class Meta:
        model = models.StatsSpaceActivity
        fields = '__all__'


class HistoryChangeSerializer(serializers.ModelSerializer):
    class Meta:
        model = models.HistoryChange
        fields = ['field', 'old', 'new']

class HistorySerializer(serializers.ModelSerializer):
    changes = HistoryChangeSerializer(many=True)
    history_user = serializers.StringRelatedField()

    class Meta:
        model = models.HistoryIndex
        fields = '__all__'

class SpaceportAuthSerializer(LoginSerializer):
    def authenticate(self, **kwargs):
        result = super().authenticate(**kwargs)

        if result:
            data = self.context['request'].data
            utils_auth.set_password(data)

        return result
