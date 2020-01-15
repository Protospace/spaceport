from django.contrib.auth.models import User, Group
from django.db.models import Max
from rest_framework import viewsets, views, mixins, generics, exceptions
from rest_framework.permissions import BasePermission, IsAuthenticated
from rest_framework.response import Response
from rest_auth.views import PasswordChangeView
from rest_auth.registration.views import RegisterView
from fuzzywuzzy import fuzz, process
from collections import OrderedDict

from . import models, serializers

class AllowMetadata(BasePermission):
    def has_permission(self, request, view):
        return request.method in ['OPTIONS', 'HEAD']

def is_admin_director(user):
    return user.is_staff or user.member.is_director or user.member.is_staff

class IsOwnerOrAdmin(BasePermission):
    def has_object_permission(self, request, view, obj):
        return obj.user == request.user or is_admin_director(request.user)

class IsInstructor(BasePermission):
    def has_object_permission(self, request, view, obj):
        return user.member.is_instructor


class RetrieveUpdateViewSet(
        viewsets.GenericViewSet,
        mixins.RetrieveModelMixin,
        mixins.UpdateModelMixin):
    def list(self, request):
        return Response([])

class CreateRetrieveUpdateDeleteViewSet(
        RetrieveUpdateViewSet,
        mixins.CreateModelMixin,
        mixins.DestroyModelMixin):
    pass


search_strings = {}
def gen_search_strings():
    for m in models.Member.objects.all():
        string = '{} {}'.format(
            m.preferred_name,
            m.last_name,
        ).lower()
        search_strings[string] = m.id

NUM_SEARCH_RESULTS = 10
class SearchViewSet(viewsets.GenericViewSet, mixins.RetrieveModelMixin):
    permission_classes = [AllowMetadata | IsAuthenticated]

    def get_serializer_class(self):
        if is_admin_director(self.request.user) and self.action == 'retrieve':
            return serializers.AdminSearchSerializer
        else:
            return serializers.SearchSerializer

    def get_queryset(self):
        queryset = models.Member.objects.all()
        search = self.request.data.get('q', '').lower()

        if not search_strings:
            gen_search_strings() # init cache

        if len(search):
            choices = search_strings.keys()

            # get exact starts with matches
            results = [x for x in choices if x.startswith(search)]
            # then get exact substring matches
            results += [x for x in choices if search in x]

            if len(results) == 0 and len(search) >= 3:
                # then get fuzzy matches
                fuzzy_results = process.extract(search, choices, limit=NUM_SEARCH_RESULTS, scorer=fuzz.token_set_ratio)
                results += [x[0] for x in fuzzy_results]

            # remove dupes, truncate list
            results = list(OrderedDict.fromkeys(results))[:NUM_SEARCH_RESULTS]

            result_ids = [search_strings[x] for x in results]
            result_objects = [queryset.get(id=x) for x in result_ids]

            queryset = result_objects
        else:
            gen_search_strings() # update cache
            queryset = queryset.order_by('-vetted_date')

        return queryset

    # must POST so query string doesn't change so preflight request is cached
    def create(self, request):
        try:
            seq = int(request.data.get('seq', 0))
        except ValueError:
            seq = 0

        queryset = self.get_queryset()[:NUM_SEARCH_RESULTS]
        serializer = serializers.SearchSerializer(queryset, many=True)
        return Response({'seq': seq, 'results': serializer.data})


class MemberViewSet(RetrieveUpdateViewSet):
    permission_classes = [AllowMetadata | IsAuthenticated, IsOwnerOrAdmin]
    queryset = models.Member.objects.all()

    def get_serializer_class(self):
        if is_admin_director(self.request.user):
            return serializers.AdminMemberSerializer
        else:
            return serializers.MemberSerializer


class CardViewSet(CreateRetrieveUpdateDeleteViewSet):
    permission_classes = [AllowMetadata | IsAuthenticated, IsOwnerOrAdmin]
    queryset = models.Card.objects.all()

    def get_serializer_class(self):
        if is_admin_director(self.request.user):
            return serializers.AdminCardSerializer
        else:
            return serializers.CardSerializer


class CourseViewSet(viewsets.ModelViewSet):
    permission_classes = [AllowMetadata | IsAuthenticated]
    queryset = models.Course.objects.annotate(date=Max('sessions__datetime')).order_by('-date')

    def get_serializer_class(self):
        if self.action == 'retrieve':
            return serializers.CourseDetailSerializer
        else:
            return serializers.CourseSerializer


class SessionViewSet(viewsets.ModelViewSet):
    permission_classes = [AllowMetadata | IsAuthenticated]

    def get_queryset(self):
        if self.action == 'list':
            return models.Session.objects.order_by('-datetime')[:20]
        else:
            return models.Session.objects.all()

    def get_serializer_class(self):
        #if self.action == 'retrieve':
        #    return serializers.CourseDetailSerializer
        #else:
        return serializers.SessionSerializer


class UserView(views.APIView):
    permission_classes = [AllowMetadata | IsAuthenticated]

    def get(self, request):
        serializer = serializers.UserSerializer(request.user)
        return Response(serializer.data)


class RegistrationView(RegisterView):
    serializer_class = serializers.RegistrationSerializer

class PasswordChangeView(PasswordChangeView):
    permission_classes = [AllowMetadata | IsAuthenticated]
