import logging
logger = logging.getLogger(__name__)

from django.contrib.auth.models import User, Group
from django.shortcuts import get_object_or_404
from django.utils.timezone import now
from rest_framework import serializers
from rest_framework.exceptions import ValidationError
from rest_framework.validators import UniqueValidator
from rest_auth.registration.serializers import RegisterSerializer
from rest_auth.serializers import PasswordChangeSerializer, PasswordResetSerializer, PasswordResetConfirmSerializer, LoginSerializer
from rest_auth.serializers import UserDetailsSerializer
import re
import datetime, time

from . import models, fields, utils, utils_ldap, utils_auth, utils_stats
from .. import settings, secrets

class UsageSerializer(serializers.ModelSerializer):
    first_name = serializers.SerializerMethodField()

    class Meta:
        model = models.Usage
        fields = '__all__'

    def get_first_name(self, obj):
        return obj.user.member.preferred_name

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
    member_id = serializers.SerializerMethodField()
    member_name = serializers.SerializerMethodField()
    date = serializers.DateField()
    report_type = serializers.ChoiceField([
        'Unmatched Member',
        'Unmatched Purchase',
        'User Flagged',
    ], allow_null=True, required=False)
    number_of_membership_months = serializers.IntegerField(max_value=36, min_value=-36)
    recorder = serializers.SerializerMethodField()

    class Meta:
        model = models.Transaction
        fields = '__all__'
        read_only_fields = [
            'id',
            'user',
            'recorder',
            'paypal_txn_id',
            'paypal_txn_type',
            'paypal_payer_id',
        ]

    def create(self, validated_data):
        if not self.initial_data.get('member_id', None):
            raise ValidationError(dict(member_id='This field is required.'))

        member = get_object_or_404(models.Member, id=self.initial_data['member_id'])
        validated_data['user'] = member.user

        if validated_data['account_type'] != 'Clearing':
            if validated_data['amount'] == 0:
                raise ValidationError(dict(account_type='You can\'t have a $0.00 {} transaction. Do you want "Membership Adjustment"?'.format(validated_data['account_type'])))
            elif validated_data['amount'] < 0.1:
                raise ValidationError(dict(amount='Don\'t try and trick me.'))

        if validated_data['account_type'] == 'PayPal':
            msg = 'Manual PayPal transaction added:\n' + str(validated_data)
            utils.alert_tanner(msg)

        if validated_data['account_type'] in ['Interac', 'Dream Pmt', 'Square Pmt', 'PayPal']:
            if not validated_data.get('reference_number', None):
                raise ValidationError(dict(reference_number='This field is required.'))

        return super().create(validated_data)

    def update(self, instance, validated_data):
        if not self.initial_data.get('member_id', None):
            raise ValidationError(dict(member_id='This field is required.'))

        member = get_object_or_404(models.Member, id=self.initial_data['member_id'])
        validated_data['user'] = member.user
        return super().update(instance, validated_data)

    def get_member_id(self, obj):
        if not obj.user: return None
        return obj.user.member.id

    def get_member_name(self, obj):
        if not obj.user: return 'Unknown'

        member = obj.user.member
        return member.preferred_name + ' ' + member.last_name

    def get_recorder(self, obj):
        if obj.recorder:
            return obj.recorder.username
        else:
            return None


# member viewing other members
# hide info for non-vetted members so someone sitting
# in our parking lot can't scrape all our info
class OtherMemberSerializer(serializers.ModelSerializer):
    last_name = serializers.SerializerMethodField()

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
            'public_bio',
        ]

    def get_last_name(self, obj):
        if len(obj.last_name):
            return obj.last_name[0] + '.'
        else:
            return ''

# vetted member viewing other members
class VettedOtherMemberSerializer(serializers.ModelSerializer):
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


# member viewing his own details
class MemberSerializer(serializers.ModelSerializer):
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
            'tormach_cnc_cert_date',
            'precix_cnc_cert_date',
            'rabbit_cert_date',
            'trotec_cert_date',
            'is_allowed_entry',
        ]

    def update(self, instance, validated_data):
        instance.user.email = validated_data.get('email', instance.user.email)
        instance.user.save()

        photo = validated_data.get('photo', None)
        crop = validated_data.get('crop', None)
        if photo:
            small, medium, large = utils.process_image_upload(photo, crop)
            instance.photo_small = small
            instance.photo_medium = medium
            instance.photo_large = large

        if 'discourse_username' in validated_data:
            changed = validated_data['discourse_username'] != instance.discourse_username
            if changed and utils_auth.discourse_is_configured():
                username = instance.discourse_username
                new_username = validated_data['discourse_username']
                logger.info('Changing discourse_username from %s to %s', username, new_username)
                if utils_auth.change_discourse_username(username, new_username) != 200:
                    msg = 'Problem connecting to Discourse Auth server: change username.'
                    utils.alert_tanner(msg)
                    logger.info(msg)
                    raise ValidationError(dict(discourse_username='Invalid Discourse username.'))

        if validated_data.get('allow_last_scanned', None) == True:
            changed = validated_data['allow_last_scanned'] != instance.allow_last_scanned
            ONE_WEEK = now() - datetime.timedelta(days=7)
            if changed and models.HistoryChange.objects.filter(
                field='allow_last_scanned',
                index__history_user__member__id=instance.id,
                index__owner_id=instance.id,
                index__history_date__gte=ONE_WEEK,
            ).count() >= 6:
                msg = 'Member allow_last_scanned rate limit exceeded by: ' + instance.first_name + ' ' + instance.last_name
                utils.alert_tanner(msg)
                logger.info(msg)
                raise ValidationError(dict(allow_last_scanned='You\'re doing that too often.'))

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
        if 'is_allowed_entry' in validated_data:
            changed = validated_data['is_allowed_entry'] != instance.is_allowed_entry
            if changed:
                utils_stats.changed_card()

        if 'precix_cnc_cert_date' in validated_data:
            changed = validated_data['precix_cnc_cert_date'] != instance.precix_cnc_cert_date
            if changed:
                if validated_data['precix_cnc_cert_date']:
                    utils_ldap.add_to_group(instance, 'CNC-Precix-Users')
                else:
                    utils_ldap.remove_from_group(instance, 'CNC-Precix-Users')

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

# vetted member viewing member list or search result
class VettedSearchSerializer(serializers.Serializer):
    q = serializers.CharField(write_only=True, max_length=64)
    seq = serializers.IntegerField(write_only=True)
    member = serializers.SerializerMethodField()

    def get_member(self, obj):
        serializer = VettedOtherMemberSerializer(obj)
        return serializer.data

# instructor viewing search result
class InstructorSearchSerializer(serializers.Serializer):
    member = serializers.SerializerMethodField()
    training = serializers.SerializerMethodField()

    def get_member(self, obj):
        serializer = VettedOtherMemberSerializer(obj)
        return serializer.data

    def get_training(self, obj):
        queryset = obj.user.training
        serializer = UserTrainingSerializer(data=queryset, many=True)
        serializer.is_valid()
        return serializer.data

# admin viewing search result
class AdminSearchSerializer(serializers.Serializer):
    cards = serializers.SerializerMethodField()
    member = serializers.SerializerMethodField()
    training = serializers.SerializerMethodField()
    transactions = serializers.SerializerMethodField()
    #usages = serializers.SerializerMethodField()

    def get_member(self, obj):
        serializer = AdminMemberSerializer(obj)
        return serializer.data

    def get_cards(self, obj):
        queryset = obj.user.cards
        queryset = queryset.order_by('-last_seen')
        serializer = CardSerializer(data=queryset, many=True)
        serializer.is_valid()
        return serializer.data

    def get_training(self, obj):
        queryset = obj.user.training
        serializer = UserTrainingSerializer(data=queryset, many=True)
        serializer.is_valid()
        return serializer.data

    def get_transactions(self, obj):
        queryset = obj.user.transactions
        queryset = queryset.order_by('-id', '-date')
        serializer = TransactionSerializer(data=queryset, many=True)
        serializer.is_valid()
        return serializer.data

    #def get_usages(self, obj):
    #    queryset = obj.user.usages.order_by('-start_time')
    #    serializer = UsageSerializer(data=queryset, many=True)
    #    serializer.is_valid()
    #    return serializer.data


class CardSerializer(serializers.ModelSerializer):
    card_number = serializers.CharField(validators=[UniqueValidator(
        queryset=models.Card.objects.all(),
        message='Card number already exists.'
    )])
    member_id = serializers.SerializerMethodField()
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
            'last_seen',
            'last_seen_at',
            'user',
        ]

    def create(self, validated_data):
        if not self.initial_data.get('member_id', None):
            raise ValidationError(dict(member_id='This field is required.'))

        member = get_object_or_404(models.Member, id=self.initial_data['member_id'])
        validated_data['user'] = member.user

        if not member.vetted_date:
            raise ValidationError(dict(non_field_errors='Member not vetted yet.'))
        return super().create(validated_data)

    def update(self, instance, validated_data):
        if not self.initial_data.get('member_id', None):
            raise ValidationError(dict(member_id='This field is required.'))

        member = get_object_or_404(models.Member, id=self.initial_data['member_id'])
        validated_data['user'] = member.user
        return super().update(instance, validated_data)

    def get_member_id(self, obj):
        if not obj.user: return None
        return obj.user.member.id


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
        member = obj.user.member
        return member.preferred_name + ' ' + member.last_name

    def get_student_email(self, obj):
        return obj.user.email

    def get_student_id(self, obj):
        return obj.user.member.id


class StudentTrainingSerializer(TrainingSerializer):
    attendance_status = serializers.ChoiceField(['Waiting for payment', 'Withdrawn'])


class CourseSerializer(serializers.ModelSerializer):
    class Meta:
        model = models.Course
        fields = ['id', 'name', 'is_old', 'description', 'tags']

class SessionSerializer(serializers.ModelSerializer):
    student_count = serializers.SerializerMethodField()
    course_data = serializers.SerializerMethodField()
    instructor_name = serializers.SerializerMethodField()
    instructor_id = serializers.SerializerMethodField()
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

    def get_course_data(self, obj):
        return CourseSerializer(obj.course).data

    def get_instructor_name(self, obj):
        if obj.instructor and hasattr(obj.instructor, 'member'):
            name = '{} {}.'.format(obj.instructor.member.preferred_name, obj.instructor.member.last_name[0])
        else:
            name = 'Unknown'
        return obj.old_instructor or name

    def get_instructor_id(self, obj):
        if obj.instructor and hasattr(obj.instructor, 'member'):
            return obj.instructor.member.id
        else:
            return None

class SessionListSerializer(SessionSerializer):
    students = None


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
    app_version = serializers.SerializerMethodField()

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
            'app_version',
            #'usages',
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

    def get_app_version(self, obj):
        return settings.APP_VERSION


class MyRegisterSerializer(RegisterSerializer):
    first_name = serializers.CharField(max_length=32)
    last_name = serializers.CharField(max_length=32)
    request_id = serializers.CharField(required=False)

    def validate_username(self, username):
        if re.search(r'[^a-z.]', username):
            raise ValidationError('Invalid characters.')
        if '..' in username:
            raise ValidationError('Can\'t have double periods. Remove spaces.')
        if username.startswith('.') or username.endswith('.'):
            raise ValidationError('Can\'t start or end with periods.')
        return super().validate_username(username)

    def custom_signup(self, request, user):
        data = request.data

        if not utils.is_request_from_protospace(request):
            logger.info('Request not from protospace')
            user.delete()
            raise ValidationError(dict(non_field_errors='Can only register from Protospace.'))

        if data['request_id']: utils_stats.set_progress(data['request_id'], 'Registering...')

        utils.register_user(data, user)

class MyPasswordChangeSerializer(PasswordChangeSerializer):
    def save(self):
        request_id = self.request.data.get('request_id', '')

        data = dict(
            username=self.user.username,
            password1=self.request.data['new_password1'],
        )

        if utils_ldap.is_configured():
            if request_id: utils_stats.set_progress(request_id, 'Changing LDAP password...')
            if utils_ldap.set_password(data) != 200:
                msg = 'Problem connecting to LDAP server: set.'
                utils.alert_tanner(msg)
                logger.info(msg)
                raise ValidationError(dict(non_field_errors=msg))

        data = dict(
            username=self.user.username,
            password=self.data['new_password1'],
            email=self.user.email,
            first_name=self.user.member.first_name,
        )

        if utils_auth.wiki_is_configured():
            if request_id: utils_stats.set_progress(request_id, 'Changing Wiki password...')
            if utils_auth.set_wiki_password(data) != 200:
                msg = 'Problem connecting to Wiki Auth server: set.'
                utils.alert_tanner(msg)
                logger.info(msg)
                raise ValidationError(dict(non_field_errors=msg))

        data['username'] = self.user.member.discourse_username or self.user.username

        if utils_auth.discourse_is_configured():
            if request_id: utils_stats.set_progress(request_id, 'Changing Discourse password...')
            if utils_auth.set_discourse_password(data) != 200:
                msg = 'Problem connecting to Discourse Auth server: set.'
                utils.alert_tanner(msg)
                logger.info(msg)
                raise ValidationError(dict(non_field_errors=msg))
            if not self.user.member.discourse_username:
                self.user.member.discourse_username = self.user.username
                self.user.member.save()

        if request_id: utils_stats.set_progress(request_id, 'Changing Spaceport password...')
        time.sleep(1)

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
        request_id = self.data['token'][-10:]

        data = dict(
            username=self.user.username,
            password1=self.data['new_password1'],
        )

        if utils_ldap.is_configured():
            if request_id: utils_stats.set_progress(request_id, 'Changing LDAP password...')
            if utils_ldap.set_password(data) != 200:
                msg = 'Problem connecting to LDAP server: set.'
                utils.alert_tanner(msg)
                logger.info(msg)
                raise ValidationError(dict(non_field_errors=msg))

        data = dict(
            username=self.user.username,
            password=self.data['new_password1'],
            email=self.user.email,
            first_name=self.user.member.first_name,
        )

        if utils_auth.wiki_is_configured():
            if request_id: utils_stats.set_progress(request_id, 'Changing Wiki password...')
            if utils_auth.set_wiki_password(data) != 200:
                msg = 'Problem connecting to Wiki Auth server: set.'
                utils.alert_tanner(msg)
                logger.info(msg)
                raise ValidationError(dict(non_field_errors=msg))

        data['username'] = self.user.member.discourse_username or self.user.username

        if utils_auth.discourse_is_configured():
            if request_id: utils_stats.set_progress(request_id, 'Changing Discourse password...')
            if utils_auth.set_discourse_password(data) != 200:
                msg = 'Problem connecting to Discourse Auth server: set.'
                utils.alert_tanner(msg)
                logger.info(msg)
                raise ValidationError(dict(non_field_errors=msg))
            if not self.user.member.discourse_username:
                self.user.member.discourse_username = self.user.username
                self.user.member.save()

        member = self.user.member
        logging.info('Password reset completed for: {} {} ({})'.format(member.first_name, member.last_name, member.id))

        if request_id: utils_stats.set_progress(request_id, 'Success! You can now log in as: ' + self.user.username)

        time.sleep(1)

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
        user = super().authenticate(**kwargs)

        if user:
            data = self.context['request'].data.copy()
            data['email'] = user.email
            data['first_name'] = user.member.first_name

            utils_auth.set_wiki_password(data)

            data['username'] = user.member.discourse_username or user.username
            utils_auth.set_discourse_password(data)

            if not user.member.paused_date:
                utils_auth.add_discourse_group_members('protospace_members', [data['username']])

            if not user.member.discourse_username:
                user.member.discourse_username = user.username
                user.member.save()

        return user

class MyLoginSerializer(LoginSerializer):
    def authenticate(self, **kwargs):
        username = kwargs.get('username', '')

        if 'your' in username and 'own' in username and 'name' in username:
            raise ValidationError(dict(username='*server explodes*'))

        if ' ' in username:
            raise ValidationError(dict(username='Username shouldn\'t have spaces. Try "first.last" or "first.middle.last".'))

        if 'first.last' in username:
            raise ValidationError(dict(username='Don\'t literally try "first.last", use your own name.'))

        if 'first.middle.last' in username:
            raise ValidationError(dict(username='Don\'t literally try "first.middle.last", use your own name.'))

        if not User.objects.filter(username=username).exists():
            raise ValidationError(dict(username='Username not found. Try "first.last" or "first.middle.last".'))

        user = super().authenticate(**kwargs)

        if not user:
            raise ValidationError(dict(password='Incorrect password. Check caps lock.'))

        return user
