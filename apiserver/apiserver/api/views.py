from django.contrib.auth.models import User, Group
from django.shortcuts import get_object_or_404
from django.db.models import Max
from django.http import HttpResponse
from django.core.files.base import File
from rest_framework import viewsets, views, mixins, generics, exceptions
from rest_framework.decorators import action
from rest_framework.permissions import BasePermission, IsAuthenticated, SAFE_METHODS
from rest_framework.response import Response
from rest_auth.views import PasswordChangeView
from rest_auth.registration.views import RegisterView
from fuzzywuzzy import fuzz, process
from collections import OrderedDict
import datetime

import requests

from . import models, serializers, utils, utils_paypal
from .permissions import (
    is_admin_director,
    AllowMetadata,
    IsObjOwnerOrAdmin,
    IsSessionInstructorOrAdmin,
    ReadOnly,
    IsAdminOrReadOnly,
    IsInstructorOrReadOnly
)

# define some shortcuts
Base = viewsets.GenericViewSet
List = mixins.ListModelMixin
Retrieve = mixins.RetrieveModelMixin
Create = mixins.CreateModelMixin
Update = mixins.UpdateModelMixin
Destroy = mixins.DestroyModelMixin

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

        if not utils.search_strings:
            utils.gen_search_strings() # init cache

        if len(search):
            choices = utils.search_strings.keys()

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

            result_ids = [utils.search_strings[x] for x in results]
            result_objects = [queryset.get(id=x) for x in result_ids]

            queryset = result_objects
        elif self.action == 'create':
            utils.gen_search_strings() # update cache
            queryset = queryset.order_by('-vetted_date')

        return queryset

    # must POST so query string doesn't change so preflight request is cached
    # to save an OPTIONS request so search is fast
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

    def perform_create(self, serializer):
        member = serializer.save()
        utils.tally_membership_months(member)
        utils.gen_member_forms(member)

    def perform_update(self, serializer):
        member = serializer.save()
        utils.tally_membership_months(member)
        utils.gen_member_forms(member)

    @action(detail=True, methods=['post'])
    def pause(self, request, pk=None):
        if not is_admin_director(self.request.user):
            raise exceptions.PermissionDenied()
        member = self.get_object()
        member.paused_date = datetime.date.today()
        member.save()
        return Response(200)

    @action(detail=True, methods=['post'])
    def unpause(self, request, pk=None):
        if not is_admin_director(self.request.user):
            raise exceptions.PermissionDenied()
        member = self.get_object()
        member.current_start_date = datetime.date.today()
        member.paused_date = None
        member.save()
        utils.tally_membership_months(member)
        utils.gen_member_forms(member)
        return Response(200)


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

    # TODO: turn these into @actions
    # TODO: check if full
    def perform_create(self, serializer):
        session_id = self.request.data['session']
        status = self.request.data['attendance_status']
        session = get_object_or_404(models.Session, id=session_id)
        training = models.Training.objects.filter(user=self.request.user, session=session)
        if training.exists():
            raise exceptions.ValidationError('You have already registered')
        if self.request.user == session.instructor:
            raise exceptions.ValidationError('You are teaching this session')
        if status == 'Waiting for payment' and session.cost == 0:
            status = 'Confirmed'
        serializer.save(user=self.request.user, attendance_status=status)

    def perform_update(self, serializer):
        session_id = self.request.data['session']
        status = self.request.data['attendance_status']
        session = get_object_or_404(models.Session, id=session_id)
        if status == 'Waiting for payment' and session.cost == 0:
            status = 'Confirmed'
        serializer.save(attendance_status=status)


class TransactionViewSet(Base, List, Create, Retrieve, Update):
    permission_classes = [AllowMetadata | IsAuthenticated, IsObjOwnerOrAdmin]
    serializer_class = serializers.TransactionSerializer

    def get_queryset(self):
        queryset = models.Transaction.objects
        if self.action == 'list':
            return queryset.exclude(report_type__isnull=True).order_by('-id', '-date')
        else:
            return queryset.all()

    def retally_membership(self):
        member_id = self.request.data['member_id']
        member = get_object_or_404(models.Member, id=member_id)
        utils.tally_membership_months(member)

    def train_paypal_hint(self, tx):
        if tx.paypal_payer_id and tx.member_id:
            models.PayPalHint.objects.update_or_create(
                account=tx.paypal_payer_id,
                defaults=dict(member_id=tx.member_id),
            )

    def perform_create(self, serializer):
        serializer.save(recorder=self.request.user)
        self.retally_membership()

    def perform_update(self, serializer):
        tx = serializer.save()
        self.retally_membership()
        self.train_paypal_hint(tx)

    def list(self, request):
        if not is_admin_director(self.request.user):
            raise exceptions.PermissionDenied()
        return super().list(request)

    @action(detail=True, methods=['post'])
    def report(self, request, pk=None):
        report_memo = request.data.get('report_memo', '').strip()
        if not report_memo:
            raise exceptions.ValidationError(dict(report_memo='This field may not be blank.'))
        transaction = self.get_object()
        transaction.report_type = 'User Flagged'
        transaction.report_memo = report_memo
        transaction.save()
        return Response(200)


class UserView(views.APIView):
    permission_classes = [AllowMetadata | IsAuthenticated]

    def get(self, request):
        serializer = serializers.UserSerializer(request.user)
        return Response(serializer.data)


class PingView(views.APIView):
    permission_classes = [AllowMetadata | IsAuthenticated]

    def post(self, request):
        return Response(200)



class DoorViewSet(viewsets.ViewSet, List):
    def list(self, request):
        cards = models.Card.objects.filter(active_status='card_active')
        active_member_cards = {}

        # format cards to match Emrah's conversion script, fix later
        for card in cards:
            member = get_object_or_404(models.Member, id=card.member_id)
            if member.paused_date: continue

            active_member_cards[card.card_number] = dict(
                name=member.first_name + ' ' + member.last_name[0],
                id=member.id,
                enabled=True,
            )

        return Response(active_member_cards)

    @action(detail=True, methods=['post'])
    def seen(self, request, pk=None):
        card = get_object_or_404(models.Card, card_number=pk)
        card.last_seen_at = datetime.date.today()
        card.save()
        return Response(200)



class IpnView(views.APIView):
    def post(self, request):
        try:
            utils_paypal.process_paypal_ipn(request.data)
        except BaseException as e:
            print('Problem processing IPN: {} - {}'.format(e.__class__.__name__, str(e)))
        finally:
            return Response(200)


class RegistrationView(RegisterView):
    serializer_class = serializers.RegistrationSerializer


class PasswordChangeView(PasswordChangeView):
    permission_classes = [AllowMetadata | IsAuthenticated]
