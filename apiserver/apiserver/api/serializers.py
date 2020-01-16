from django.contrib.auth.models import User, Group
from django.shortcuts import get_object_or_404
from rest_framework import serializers
from rest_framework.exceptions import ValidationError
from rest_framework.validators import UniqueValidator
from rest_auth.registration.serializers import RegisterSerializer
from rest_auth.serializers import UserDetailsSerializer
from uuid import uuid4
from PIL import Image
from bleach.sanitizer import Cleaner

from . import models, old_models

#custom_error = lambda x: ValidationError(dict(non_field_errors=x))

STATIC_FOLDER = 'data/static/'
LARGE_SIZE = 1080
MEDIUM_SIZE = 220
SMALL_SIZE = 110

def process_image(upload):
    try:
        pic = Image.open(upload)
    except OSError:
        raise serializers.ValidationError('Invalid image file.')

    if pic.format == 'PNG':
        ext = '.png'
    elif pic.format == 'JPEG':
        ext = '.jpg'
    else:
        raise serializers.ValidationError('Image must be a jpg or png.')

    large = str(uuid4()) + ext
    pic.thumbnail([LARGE_SIZE, LARGE_SIZE], Image.ANTIALIAS)
    pic.save(STATIC_FOLDER + large)

    medium = str(uuid4()) + ext
    pic.thumbnail([MEDIUM_SIZE, MEDIUM_SIZE], Image.ANTIALIAS)
    pic.save(STATIC_FOLDER + medium)

    small = str(uuid4()) + ext
    pic.thumbnail([SMALL_SIZE, SMALL_SIZE], Image.ANTIALIAS)
    pic.save(STATIC_FOLDER + small)

    return small, medium, large


ALLOWED_TAGS = [
        'h3',
        'p',
        'br',
        'strong',
        'em',
        'u',
        'code',
        'ol',
        'li',
        'ul',
        'a',
        ]

clean = Cleaner(tags=ALLOWED_TAGS).clean





class UserEmailField(serializers.ModelField):
    def to_representation(self, obj):
        return getattr(obj.user, 'email', obj.old_email)
    def to_internal_value(self, data):
        return serializers.EmailField().run_validation(data)

class HTMLField(serializers.CharField):
    def to_internal_value(self, data):
        data = clean(data)
        return super().to_internal_value(data)



# member viewing other members
class OtherMemberSerializer(serializers.ModelSerializer):
    class Meta:
        model = models.Member
        fields = ['id', 'preferred_name', 'last_name', 'status', 'current_start_date', 'photo_small', 'photo_large']

# member viewing his own details
class MemberSerializer(serializers.ModelSerializer):
    photo = serializers.ImageField(write_only=True, required=False)
    email = UserEmailField(serializers.EmailField)
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
            'status',
            'expire_date',
            'current_start_date',
            'application_date',
            'vetted_date',
            'monthly_fees',
            'photo_large',
            'photo_medium',
            'photo_small',
            'user',
            'old_email',
        ]

    def update(self, instance, validated_data):
        if instance.user:
            instance.user.email = validated_data.get('email', instance.user.email)
            instance.user.save()
        else:
            instance.old_email = validated_data.get('email', instance.old_email)

        photo = validated_data.get('photo', None)
        if photo:
            small, medium, large = process_image(photo)
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
            'photo_large',
            'photo_medium',
            'photo_small',
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

    def get_member(self, obj):
        serializer = AdminMemberSerializer(obj)
        return serializer.data

    def get_cards(self, obj):
        if obj.user:
            queryset = obj.user.cards
        else:
            queryset = models.Card.objects.filter(member_id=obj.id)
        serializer = CardSerializer(data=queryset, many=True)
        serializer.is_valid()
        return serializer.data



class CardSerializer(serializers.ModelSerializer):
    card_number = serializers.CharField(validators=[UniqueValidator(
        queryset=models.Card.objects.all(),
        message='Card number already exists.'
    )])
    member_id = serializers.IntegerField()
    active_status = serializers.ChoiceField(['card_blocked', 'card_inactive', 'card_member_blocked', 'card_active'])
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



class UserTrainingSerializer(serializers.ModelSerializer):
    class Meta:
        model = models.Training
        exclude = ['user']
        depth = 2

class UserSerializer(serializers.ModelSerializer):
    training = UserTrainingSerializer(many=True)
    member = MemberSerializer()

    class Meta:
        model = User
        fields = ['id', 'username', 'member', 'transactions', 'cards', 'training', 'is_staff']
        depth = 1



class TransactionSerializer(serializers.ModelSerializer):
    class Meta:
        model = models.Transaction
        fields = '__all__'



class TrainingSerializer(serializers.ModelSerializer):
    attendance_status = serializers.ChoiceField(['waiting for payment', 'withdrawn', 'rescheduled', 'no-show', 'attended', 'confirmed'])
    session = serializers.PrimaryKeyRelatedField(queryset=models.Session.objects.all())
    class Meta:
        model = models.Training
        fields = '__all__'
        read_only_fields = ['user', 'sign_up_date', 'paid_date', 'member_id']

class StudentTrainingSerializer(TrainingSerializer):
    attendance_status = serializers.ChoiceField(['waiting for payment', 'withdrawn'])



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
        return len([x for x in obj.students.all() if x.attendance_status != 'withdrawn'])
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
    description = HTMLField(max_length=6000)
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
