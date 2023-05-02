import logging
logger = logging.getLogger(__name__)

from django.contrib.auth.models import User, Group
from django.shortcuts import get_object_or_404
from django.db.models import Max, F, Count, Q, Sum
from django.utils.timezone import now
from rest_framework import serializers
from rest_framework.exceptions import ValidationError
from rest_framework.validators import UniqueValidator
from rest_auth.registration.serializers import RegisterSerializer
from rest_auth.serializers import PasswordChangeSerializer, PasswordResetSerializer, PasswordResetConfirmSerializer, LoginSerializer
from rest_auth.serializers import UserDetailsSerializer
import re
import datetime, time, calendar

from . import models, fields, utils, utils_ldap, utils_auth, utils_stats
from .. import settings, secrets
from .permissions import is_admin_director

class UsageSerializer(serializers.ModelSerializer):
    first_name = serializers.SerializerMethodField()

    class Meta:
        model = models.Usage
        fields = '__all__'

    def get_first_name(self, obj):
        return obj.user.member.preferred_name

class ProtocoinTransactionSerializer(serializers.ModelSerializer):
    class Meta:
        model = models.Transaction
        fields = [
            'id',
            'date',
            'protocoin',
            'account_type',
            'category',
        ]

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
        'Protocoin',
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
        'Exchange',
    ])
    member_id = serializers.SerializerMethodField()
    member_name = serializers.SerializerMethodField()
    date = serializers.DateField()
    report_type = serializers.ChoiceField([
        'Unmatched Member',
        'Unmatched Purchase',
        'User Flagged',
    ], allow_null=True, required=False)
    number_of_membership_months = serializers.IntegerField(max_value=36, min_value=-36, default=0)
    recorder = serializers.SerializerMethodField()
    amount = serializers.DecimalField(max_digits=7, decimal_places=2, default=0)
    protocoin = serializers.DecimalField(max_digits=7, decimal_places=2, default=0)

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

    def validate_transaction(self, validated_data):
        if not self.initial_data.get('member_id', None):
            raise ValidationError(dict(member_id='This field is required.'))

        member = get_object_or_404(models.Member, id=self.initial_data['member_id'])
        validated_data['user'] = member.user

        if validated_data['account_type'] == 'Protocoin':
            validated_data['amount'] = 0
        else:
            validated_data['protocoin'] = 0

        if validated_data['category'] != 'Membership':
            validated_data['number_of_membership_months'] = 0

        if validated_data['category'] == 'Membership' and not validated_data['number_of_membership_months']:
            raise ValidationError(dict(number_of_membership_months='This field is required.'))

        if validated_data['account_type'] == 'Protocoin' and validated_data['category'] == 'Exchange':
            raise ValidationError(dict(category='Can\'t purchase Protocoin with Protocoin.'))

        if validated_data['category'] == 'Exchange':
            if validated_data['amount'] == 0:
                raise ValidationError(dict(category='Can\'t purchase 0 Protocoin.'))
            validated_data['protocoin'] = validated_data['amount']

        if validated_data['account_type'] == 'Protocoin':
            if validated_data['protocoin'] == 0:
                raise ValidationError(dict(account_type='Can\'t have a 0.00 protocoin transaction.'))

        if validated_data['account_type'] not in ['Clearing', 'Protocoin']:
            if validated_data['amount'] == 0:
                raise ValidationError(dict(account_type='Can\'t have a $0.00 {} transaction. Do you want "Membership Adjustment"?'.format(validated_data['account_type'])))

        if validated_data['account_type'] in ['Interac', 'Dream Pmt', 'Square Pmt', 'PayPal']:
            if not validated_data.get('reference_number', None):
                raise ValidationError(dict(reference_number='This field is required.'))

        return validated_data

    def create(self, validated_data):
        validated_data = self.validate_transaction(validated_data)

        if validated_data['protocoin'] < 0:
            user = validated_data['user']
            current_protocoin = user.transactions.aggregate(Sum('protocoin'))['protocoin__sum'] or 0
            new_protocoin = current_protocoin + validated_data['protocoin']
            if new_protocoin < 0:
                raise ValidationError(dict(category='Insufficient funds. Member only has {} protocoin.'.format(current_protocoin)))

        if validated_data['account_type'] == 'PayPal':
            msg = 'Manual PayPal transaction added:\n' + str(validated_data)
            utils.alert_tanner(msg)

        if validated_data['account_type'] == 'Protocoin':
            msg = 'Manual Protocoin transaction added:\n' + str(validated_data)
            utils.alert_tanner(msg)

        return super().create(validated_data)

    def update(self, instance, validated_data):
        validated_data = self.validate_transaction(validated_data)

        if validated_data['protocoin'] < 0:
            user = validated_data['user']
            # when updating, we need to subtract out the transaction being edited
            current_protocoin = (user.transactions.aggregate(Sum('protocoin'))['protocoin__sum'] or 0) - instance.protocoin
            new_protocoin = current_protocoin + validated_data['protocoin']
            if new_protocoin < 0:
                msg = 'Negative Protocoin transaction updated:\n' + str(validated_data)
                utils.alert_tanner(msg)

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
    pinball_score = serializers.IntegerField(required=False)
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
            'pinball_score',
        ]

    def get_last_name(self, obj):
        if len(obj.last_name):
            return obj.last_name[0] + '.'
        else:
            return ''

# vetted member viewing other members
class VettedOtherMemberSerializer(serializers.ModelSerializer):
    pinball_score = serializers.IntegerField(required=False)

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
            'pinball_score',
        ]


# member viewing his own details
class MemberSerializer(serializers.ModelSerializer):
    photo = serializers.ImageField(write_only=True, required=False)
    crop = serializers.CharField(write_only=True, required=False)
    email = fields.UserEmailField(serializers.EmailField)
    phone = serializers.CharField()
    protocoin = serializers.SerializerMethodField()
    total_protocoin = serializers.SerializerMethodField()

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
            'mediawiki_username',
        ]

    def get_protocoin(self, obj):
        transactions = obj.user.transactions
        total = transactions.aggregate(Sum('protocoin'))['protocoin__sum'] or 0
        return total

    def get_total_protocoin(self, obj):
        transactions = models.Transaction.objects
        total = transactions.aggregate(Sum('protocoin'))['protocoin__sum'] or 0
        return total

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
                msg = 'Member allow_last_scanned rate limit exceeded by: ' + instance.preferred_name + ' ' + instance.last_name
                utils.alert_tanner(msg)
                logger.info(msg)
                raise ValidationError(dict(allow_last_scanned='You\'re doing that too often.'))

        return super().update(instance, validated_data)

# admin viewing member details
class AdminMemberSerializer(MemberSerializer):
    phone = serializers.CharField(required=False)
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
            'mediawiki_username',
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
        queryset = queryset.order_by('-date', '-id')
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

    def update(self, instance, validated_data):
        if validated_data['attendance_status'] == 'Waiting for payment' and instance.paid_date:
            validated_data['attendance_status'] = 'Confirmed'
        return super().update(instance, validated_data)


class StudentTrainingSerializer(TrainingSerializer):
    attendance_status = serializers.ChoiceField(['Waiting for payment', 'Withdrawn'])


class CourseSerializer(serializers.ModelSerializer):
    num_interested = serializers.IntegerField(read_only=True)

    class Meta:
        model = models.Course
        fields = ['id', 'name', 'is_old', 'description', 'tags', 'num_interested']

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
        read_only_fields = ['old_instructor']

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

    def create(self, validated_data):
        if validated_data['datetime'] < now() - datetime.timedelta(days=2):
            msg = 'Past class creation detected:\n' + str(validated_data)
            utils.alert_tanner(msg)
            raise ValidationError(dict(non_field_errors='Class can\'t be in the past.'))

        return super().create(validated_data)

    def update(self, instance, validated_data):
        if not self.initial_data.get('instructor_id', None):
            raise ValidationError(dict(instructor_id='This field is required.'))

        if validated_data['datetime'] < now() - datetime.timedelta(days=2):
            msg = 'Past class modification detected:\n' + str(validated_data)
            utils.alert_tanner(msg)
            raise ValidationError(dict(non_field_errors='Can\'t modify past class.'))

        member = get_object_or_404(models.Member, id=self.initial_data['instructor_id'])
        if not (is_admin_director(member.user) or member.is_instructor):
            raise ValidationError(dict(instructor_id='Member is not an instructor.'))

        validated_data['instructor'] = member.user
        return super().update(instance, validated_data)

class SessionListSerializer(SessionSerializer):
    students = None


class CourseDetailSerializer(serializers.ModelSerializer):
    sessions = SessionListSerializer(many=True, read_only=True)
    name = serializers.CharField(max_length=100)
    description = fields.HTMLField(max_length=6000)
    suggestion = serializers.SerializerMethodField()
    class Meta:
        model = models.Course
        fields = '__all__'

    def get_suggestion(self, obj):
        def iter_dates():
            start_of_month = utils.today_alberta_tz().replace(day=1)
            for i in range(90):
                yield start_of_month + datetime.timedelta(days=i)

        def iter_matching_dates(weekday, week_num=False):
            week_num_counts = [0] * 13
            for date in iter_dates():
                if date.weekday() == weekday:
                    week_num_counts[date.month] += 1
                    if week_num and week_num_counts[date.month] != week_num:
                        continue
                    yield date

        def next_date(weekday, week_num=False, fake_start=False):
            start = fake_start or utils.today_alberta_tz()
            for date in iter_matching_dates(weekday, week_num):
                if date > start:
                    return date
            raise

        def course_is_usually_monthly(course):
            two_months_ago = utils.today_alberta_tz() - datetime.timedelta(days=61)
            recent_sessions = obj.sessions.filter(datetime__gte=two_months_ago)
            if recent_sessions.count() < 3:
                return True
            else:
                return False

        prev_session = obj.sessions.order_by('datetime').last()

        if obj.id == 273: # monthly clean 10:00 AM 3rd Saturday of each month
            date = next_date(calendar.SATURDAY, week_num=3)
            time = datetime.time(10, 0)
            dt = datetime.datetime.combine(date, time)
            dt = utils.TIMEZONE_CALGARY.localize(dt)
            cost = 0
            max_students = None
        elif obj.id == 317:
            # members' meeting 7:00 PM 3rd Thursday of odd months, Wednesday of even months
            # but December's gets skipped
            next_month = next_date(calendar.WEDNESDAY, week_num=3).month
            if next_month == 12:
                one_month_ahead = utils.today_alberta_tz() + datetime.timedelta(days=31)
                date = next_date(calendar.THURSDAY, week_num=3, fake_start=one_month_ahead)
            elif next_month % 2 == 0:
                date = next_date(calendar.WEDNESDAY, week_num=3)
            else:
                date = next_date(calendar.THURSDAY, week_num=3)
            time = datetime.time(19, 0)
            dt = datetime.datetime.combine(date, time)
            dt = utils.TIMEZONE_CALGARY.localize(dt)
            cost = 0
            max_students = None
        elif prev_session:
            dt = prev_session.datetime

            if course_is_usually_monthly(obj):
                offset_weeks = 4
            else:
                offset_weeks = 1
            dt = dt + datetime.timedelta(weeks=offset_weeks)

            five_days_from_now = utils.now_alberta_tz() + datetime.timedelta(days=5)
            while dt < five_days_from_now:
                dt = dt + datetime.timedelta(weeks=offset_weeks)

            cost = prev_session.cost
            max_students = prev_session.max_students
        else:
            return None

        return dict(datetime=dt, cost=str(cost), max_students=max_students)


class UserTrainingSerializer(serializers.ModelSerializer):
    session = SessionListSerializer()
    class Meta:
        model = models.Training
        exclude = ['user']
        depth = 2

class InterestSerializer(serializers.ModelSerializer):
    course = serializers.PrimaryKeyRelatedField(queryset=models.Course.objects.all())
    class Meta:
        model = models.Interest
        fields = '__all__'
        read_only_fields = ['user', 'satisfied_by']

class UserSerializer(serializers.ModelSerializer):
    training = UserTrainingSerializer(many=True)
    member = MemberSerializer()
    transactions = serializers.SerializerMethodField()
    training = serializers.SerializerMethodField()
    interests = InterestSerializer(many=True)
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
            'interests',
        ]
        depth = 1

    def get_transactions(self, obj):
        queryset = models.Transaction.objects.filter(user=obj)
        queryset = queryset.select_related('user', 'user__member')
        queryset = queryset.exclude(category='Memberships:Fake Months')
        queryset = queryset.order_by('-id', '-date')
        serializer = TransactionSerializer(data=queryset, many=True)
        serializer.is_valid()
        return serializer.data

    def get_training(self, obj):
        queryset = obj.training
        queryset = queryset.select_related(
            'session',
            'session__course',
            'session__instructor',
            'session__instructor__member'
        )
        queryset = queryset.prefetch_related('session__students')
        queryset = queryset.order_by('-id')
        serializer = UserTrainingSerializer(data=queryset, many=True)
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
    preferred_name = serializers.CharField(max_length=32)
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
            first_name=self.user.member.preferred_name,
        )

        data['username'] = self.user.member.mediawiki_username or self.user.username

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
        logging.info('Password reset requested for: {} - {} {} ({})'.format(email, member.preferred_name, member.last_name, member.id))
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
            first_name=self.user.member.preferred_name,
        )

        data['username'] = self.user.member.mediawiki_username or self.user.username

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
        logging.info('Password reset completed for: {} {} ({})'.format(member.preferred_name, member.last_name, member.id))

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
            data['first_name'] = user.member.preferred_name

            data['username'] = user.member.mediawiki_username or user.username
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
