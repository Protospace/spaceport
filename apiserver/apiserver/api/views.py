from django.contrib.auth.models import User, Group
from django.shortcuts import get_object_or_404
from django.db.models import Max
from rest_framework import viewsets, views, mixins, generics, exceptions
from rest_framework.permissions import BasePermission, IsAuthenticated, SAFE_METHODS
from rest_framework.response import Response
from rest_auth.views import PasswordChangeView
from rest_auth.registration.views import RegisterView
from fuzzywuzzy import fuzz, process
from collections import OrderedDict

from . import models, serializers, utils

class AllowMetadata(BasePermission):
    def has_permission(self, request, view):
        return request.method in ['OPTIONS', 'HEAD']

def is_admin_director(user):
    return bool(user.is_staff or user.member.is_director or user.member.is_staff)

class IsObjOwnerOrAdmin(BasePermission):
    def has_object_permission(self, request, view, obj):
        return bool(request.user and (obj.user == request.user or is_admin_director(request.user)))

class IsSessionInstructorOrAdmin(BasePermission):
    def has_object_permission(self, request, view, obj):
        return bool(request.user and (obj.session.instructor == request.user or is_admin_director(request.user)))

class ReadOnly(BasePermission):
    def has_permission(self, request, view):
        return bool(request.method in SAFE_METHODS)
    def has_object_permission(self, request, view, obj):
        return bool(request.method in SAFE_METHODS)

class IsAdminOrReadOnly(BasePermission):
    def has_permission(self, request, view):
        return bool(
            request.method in SAFE_METHODS or
            request.user and
            is_admin_director(request.user)
        )

class IsInstructorOrReadOnly(BasePermission):
    def has_permission(self, request, view):
        return bool(
            request.method in SAFE_METHODS or
            request.user and
            request.user.member.is_instructor
        )



Base = viewsets.GenericViewSet
List = mixins.ListModelMixin
Retrieve = mixins.RetrieveModelMixin
Create = mixins.CreateModelMixin
Update = mixins.UpdateModelMixin
Destroy = mixins.DestroyModelMixin



search_strings = {}
def gen_search_strings():
    for m in models.Member.objects.all():
        string = '{} {}'.format(
            m.preferred_name,
            m.last_name,
        ).lower()
        search_strings[string] = m.id

NUM_SEARCH_RESULTS = 10
class SearchViewSet(Base, Retrieve):
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


class MemberViewSet(Base, Retrieve, Update):
    permission_classes = [AllowMetadata | IsAuthenticated, IsObjOwnerOrAdmin]
    queryset = models.Member.objects.all()

    def get_serializer_class(self):
        if is_admin_director(self.request.user):
            return serializers.AdminMemberSerializer
        else:
            return serializers.MemberSerializer


class CardViewSet(Base, Create, Retrieve, Update, Destroy):
    permission_classes = [AllowMetadata | IsAuthenticated, IsObjOwnerOrAdmin]
    queryset = models.Card.objects.all()
    serializer_class = serializers.CardSerializer


class CourseViewSet(Base, List, Retrieve, Create, Update):
    permission_classes = [AllowMetadata | IsAuthenticated, IsAdminOrReadOnly | IsInstructorOrReadOnly]
    queryset = models.Course.objects.annotate(date=Max('sessions__datetime')).order_by('-date')

    def get_serializer_class(self):
        if self.action == 'list':
            return serializers.CourseSerializer
        else:
            return serializers.CourseDetailSerializer


class SessionViewSet(Base, List, Retrieve, Create, Update):
    permission_classes = [AllowMetadata | IsAuthenticated, IsAdminOrReadOnly | IsInstructorOrReadOnly]

    def get_queryset(self):
        if self.action == 'list':
            return models.Session.objects.order_by('-datetime')[:20]
        else:
            return models.Session.objects.all()

    def get_serializer_class(self):
        if self.action == 'list':
            return serializers.SessionListSerializer
        else:
            return serializers.SessionSerializer

    def perform_create(self, serializer):
        serializer.save(instructor=self.request.user)

class TrainingViewSet(Base, Retrieve, Create, Update):
    permission_classes = [AllowMetadata | IsAuthenticated, IsObjOwnerOrAdmin | IsSessionInstructorOrAdmin | ReadOnly]
    serializer_class = serializers.TrainingSerializer
    queryset = models.Training.objects.all()

    def get_serializer_class(self):
        user = self.request.user
        if is_admin_director(user) or user.member.is_instructor:
            return serializers.TrainingSerializer
        else:
            return serializers.StudentTrainingSerializer

    def perform_create(self, serializer):
        session_id = self.request.data['session']
        session = get_object_or_404(models.Session, id=session_id)
        training = models.Training.objects.filter(user=self.request.user, session=session)
        if training.exists():
            raise exceptions.ValidationError('You have already registered')
        if self.request.user == session.instructor:
            raise exceptions.ValidationError('You are teaching this session')
        serializer.save(user=self.request.user)


class TransactionViewSet(Base, Create, Retrieve, Update):
    permission_classes = [AllowMetadata | IsAuthenticated, IsObjOwnerOrAdmin]
    queryset = models.Transaction.objects.all()
    serializer_class = serializers.TransactionSerializer

    def retally_membership(self):
        member_id = self.request.data['member_id']
        member = get_object_or_404(models.Member, id=member_id)
        utils.tally_membership_months(member)

    def perform_create(self, serializer):
        serializer.save(recorder=self.request.user)
        self.retally_membership()

    def perform_update(self, serializer):
        serializer.save()
        self.retally_membership()


class UserView(views.APIView):
    permission_classes = [AllowMetadata | IsAuthenticated]

    def get(self, request):
        serializer = serializers.UserSerializer(request.user)
        return Response(serializer.data)


class RegistrationView(RegisterView):
    serializer_class = serializers.RegistrationSerializer

class PasswordChangeView(PasswordChangeView):
    permission_classes = [AllowMetadata | IsAuthenticated]
