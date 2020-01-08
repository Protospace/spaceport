from django.contrib.auth.models import User, Group
from rest_framework import viewsets, views, permissions
from rest_framework.response import Response
from rest_auth.registration.views import RegisterView

from . import models, serializers

class AllowMetadata(permissions.BasePermission):
    def has_permission(self, request, view):
        return request.method in ['OPTIONS', 'HEAD']


class UserViewSet(viewsets.ModelViewSet):
    queryset = User.objects.all().order_by('-date_joined')
    serializer_class = serializers.UserSerializer


class MemberViewSet(viewsets.ModelViewSet):
    permission_classes = [AllowMetadata | permissions.IsAuthenticated]
    http_method_names = ['options', 'head', 'get', 'put', 'patch']

    def get_queryset(self):
        objects = models.Member.objects.all()
        if self.request.user.is_staff:
            return objects.order_by('id')
        else:
            return objects.filter(user=self.request.user)

    def get_serializer_class(self):
        if self.request.user.is_staff:
            return serializers.AdminMemberSerializer
        else:
            return serializers.MemberSerializer


class MyUserView(views.APIView):
    permission_classes = [AllowMetadata | permissions.IsAuthenticated]

    def get(self, request):
        serializer = serializers.UserSerializer(request.user)
        return Response(serializer.data)


class RegistrationViewSet(RegisterView):
    serializer_class = serializers.RegistrationSerializer

    #def create(self, request):
    #    data = request.data.copy()
    #    data['username'] = '{}.{}'.format(
    #        data['first_name'],
    #        data['last_name']
    #    ).lower()
    #    request._full_data = data
    #    return super().create(request)

