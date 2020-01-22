from rest_framework import serializers
from . import utils

class UserEmailField(serializers.ModelField):
    def to_representation(self, obj):
        return getattr(obj.user, 'email', obj.old_email)
    def to_internal_value(self, data):
        return serializers.EmailField().run_validation(data)

class HTMLField(serializers.CharField):
    def to_internal_value(self, data):
        data = utils.clean(data)
        return super().to_internal_value(data)

