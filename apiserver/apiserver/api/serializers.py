from django.contrib.auth.models import User, Group
from rest_framework import serializers
from rest_framework.exceptions import ValidationError
from rest_auth.registration.serializers import RegisterSerializer
from rest_auth.serializers import UserDetailsSerializer
from uuid import uuid4
from PIL import Image

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



# member viewing member list or other member
class OtherMemberSerializer(serializers.ModelSerializer):
    q = serializers.CharField(write_only=True, max_length=64)
    seq = serializers.IntegerField(write_only=True)

    class Meta:
        model = models.Member
        fields = ['q', 'seq', 'id', 'preferred_name', 'last_name', 'status', 'current_start_date', 'photo_small', 'photo_large']

class UserEmailField(serializers.ModelField):
    def to_representation(self, obj):
        return obj.user.email
    def to_internal_value(self, data):
        return serializers.EmailField().run_validation(data)

# member viewing himself
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
        ]

    def update(self, instance, validated_data):
        instance.user.email = validated_data.get('email', instance.user.email)
        instance.user.save()

        photo = validated_data.get('photo', None)
        if photo:
            small, medium, large = process_image(photo)
            instance.photo_small = small
            instance.photo_medium = medium
            instance.photo_large = large

        return super().update(instance, validated_data)

# adming viewing member
class AdminMemberSerializer(MemberSerializer):
    class Meta:
        model = models.Member
        fields = '__all__'
        read_only_fields = [
            'id',
            'photo_large',
            'photo_medium',
            'photo_small',
            'user',
        ]



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
        fields = ['id', 'username', 'member', 'transactions', 'cards', 'training']
        depth = 1



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
