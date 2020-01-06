from django.contrib.auth.models import User, Group
from rest_framework import viewsets

from . import models, serializers

class UserViewSet(viewsets.ModelViewSet):
    queryset = User.objects.all().order_by('-date_joined')
    serializer_class = serializers.UserSerializer
