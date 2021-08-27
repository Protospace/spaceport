import logging
logger = logging.getLogger(__name__)

from django.contrib.auth.models import User, Group
from django.shortcuts import get_object_or_404, redirect
from django.db import transaction
from django.db.models import Max, F
from django.db.utils import OperationalError
from django.http import HttpResponse, Http404, FileResponse
from django.core.files.base import File
from django.core.cache import cache
from django.utils.timezone import now
from rest_framework import viewsets, views, mixins, generics, exceptions
from rest_framework.decorators import action, api_view
from rest_framework.permissions import BasePermission, IsAuthenticated, SAFE_METHODS, IsAuthenticatedOrReadOnly
from rest_framework.response import Response
from rest_auth.views import PasswordChangeView, PasswordResetView, PasswordResetConfirmView, LoginView
from rest_auth.registration.views import RegisterView
from fuzzywuzzy import fuzz, process
from collections import OrderedDict
import datetime, time

import requests

from . import models, serializers, utils, utils_paypal, utils_stats, utils_ldap
from .permissions import (
    is_admin_director,
    AllowMetadata,
    IsObjOwnerOrAdmin,
    IsSessionInstructorOrAdmin,
    ReadOnly,
    IsAdmin,
    IsAdminOrReadOnly,
    IsInstructorOrReadOnly
)
from .. import settings, secrets

# define some shortcuts
Base = viewsets.GenericViewSet
List = mixins.ListModelMixin
Retrieve = mixins.RetrieveModelMixin
Create = mixins.CreateModelMixin
Update = mixins.UpdateModelMixin
Destroy = mixins.DestroyModelMixin

NUM_SEARCH_RESULTS = 20


class SearchViewSet(Base, Retrieve):
    permission_classes = [AllowMetadata | IsAuthenticated]

    def get_serializer_class(self):
        if is_admin_director(self.request.user) and self.action == 'retrieve':
            return serializers.AdminSearchSerializer
        elif self.request.user.member.is_instructor and self.action == 'retrieve':
            return serializers.InstructorSearchSerializer
        elif self.request.user.member.vetted_date:
            return serializers.VettedSearchSerializer
        else:
            return serializers.SearchSerializer

    def get_queryset(self):
        queryset = models.Member.objects.all()
        search = self.request.data.get('q', '').lower()
        sort = self.request.data.get('sort', '').lower()

        if not cache.touch('search_strings'):
            utils.gen_search_strings() # init cache

        search_strings = cache.get('search_strings', {})

        if len(search):
            choices = search_strings.keys()

            # get exact starts with matches
            results = [x for x in choices if x.startswith(search)]
            # then get exact substring matches
            results += [x for x in choices if search in x]

            if len(results) == 0 and len(search) >= 3 and '@' not in search:
                # then get fuzzy matches, but not for emails
                fuzzy_results = process.extract(search, choices, limit=NUM_SEARCH_RESULTS, scorer=fuzz.token_set_ratio)
                results += [x[0] for x in fuzzy_results]

            # remove dupes, truncate list
            results = list(OrderedDict.fromkeys(results))[:NUM_SEARCH_RESULTS]

            result_ids = [search_strings[x] for x in results]
            result_objects = [queryset.get(id=x) for x in result_ids]

            queryset = result_objects
            logging.info('Search for: {}, results: {}'.format(search, len(queryset)))
        elif self.action == 'create' and sort == 'recently_vetted':
            utils.gen_search_strings() # update cache
            queryset = queryset.order_by('-vetted_date')
        elif self.action == 'create' and sort == 'newest_active':
            queryset = queryset.filter(paused_date__isnull=True)
            queryset = queryset.order_by('-application_date')
        elif self.action == 'create' and sort == 'newest_overall':
            queryset = queryset.order_by('-application_date')
        elif self.action == 'create' and sort == 'oldest_active':
            queryset = queryset.filter(paused_date__isnull=True)
            queryset = queryset.order_by('application_date')
        elif self.action == 'create' and sort == 'oldest_overall':
            queryset = queryset.filter(application_date__isnull=False)
            queryset = queryset.order_by('application_date')
        elif self.action == 'create' and sort == 'recently_inactive':
            queryset = queryset.filter(paused_date__isnull=False)
            queryset = queryset.order_by('-paused_date')
        elif self.action == 'create' and sort == 'best_looking':
            queryset = []

        return queryset

    # must POST so query string doesn't change so preflight request is cached
    # to save an OPTIONS request so search is fast
    def create(self, request):
        try:
            seq = int(request.data.get('seq', 0))
        except ValueError:
            seq = 0

        search = self.request.data.get('q', '').lower()
        if search:
            num_results = NUM_SEARCH_RESULTS
        else:
            num_results = 100

        queryset = self.get_queryset()[:num_results]

        if self.request.user.member.vetted_date:
            serializer = serializers.VettedSearchSerializer(queryset, many=True)
        else:
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
        member.status = 'Former Member'
        member.paused_date = utils.today_alberta_tz()
        member.save()
        return Response(200)

    @action(detail=True, methods=['post'])
    def unpause(self, request, pk=None):
        if not is_admin_director(self.request.user):
            raise exceptions.PermissionDenied()
        member = self.get_object()
        member.current_start_date = utils.today_alberta_tz()
        member.paused_date = None
        if not member.monthly_fees:
            member.monthly_fees = 55
        member.save()
        utils.tally_membership_months(member)
        utils.gen_member_forms(member)
        utils_stats.changed_card()
        return Response(200)

    @action(detail=True, methods=['get'])
    def card_photo(self, request, pk=None):
        if not is_admin_director(self.request.user):
            raise exceptions.PermissionDenied()
        member = self.get_object()
        if not member.photo_large:
            raise Http404
        card_photo = utils.gen_card_photo(member)
        return FileResponse(card_photo, filename='card.jpg')


class CardViewSet(Base, Create, Retrieve, Update, Destroy):
    permission_classes = [AllowMetadata | IsAdmin]
    queryset = models.Card.objects.all()
    serializer_class = serializers.CardSerializer

    def perform_create(self, serializer):
        serializer.save()
        utils_stats.changed_card()

    def perform_update(self, serializer):
        serializer.save()
        utils_stats.changed_card()


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

    def update_cert(self, session, member, status):
        # always update cert date incase member is returning and gets recertified
        if session.course.id == 249:
            member.orientation_date = utils.today_alberta_tz() if status == 'Attended' else None
        elif session.course.id == 261:
            member.wood_cert_date = utils.today_alberta_tz() if status == 'Attended' else None
        elif session.course.id == 401:
            member.wood2_cert_date = utils.today_alberta_tz() if status == 'Attended' else None
        elif session.course.id == 281:
            member.lathe_cert_date = utils.today_alberta_tz() if status == 'Attended' else None
        elif session.course.id == 283:
            member.mill_cert_date = utils.today_alberta_tz() if status == 'Attended' else None
        elif session.course.id == 259:
            member.cnc_cert_date = utils.today_alberta_tz() if status == 'Attended' else None
        elif session.course.id == 247:
            member.rabbit_cert_date = utils.today_alberta_tz() if status == 'Attended' else None

            if utils_ldap.is_configured():
                if status == 'Attended':
                    utils_ldap.add_to_group(member, 'Laser Users')
                else:
                    utils_ldap.remove_from_group(member, 'Laser Users')
        elif session.course.id == 321:
            member.trotec_cert_date = utils.today_alberta_tz() if status == 'Attended' else None

            if utils_ldap.is_configured():
                if status == 'Attended':
                    utils_ldap.add_to_group(member, 'Trotec Users')
                else:
                    utils_ldap.remove_from_group(member, 'Trotec Users')
        member.save()

    # TODO: turn these into @actions
    # TODO: check if full, but not for instructors
    # TODO: if already paid, skip to confirmed
    def perform_create(self, serializer):
        user = self.request.user
        data = self.request.data
        session_id = data['session']
        status = data['attendance_status']
        session = get_object_or_404(models.Session, id=session_id)

        if data.get('member_id', None):
            if not (is_admin_director(user) or session.instructor == user):
                raise exceptions.ValidationError('Not allowed to register others')

            member = get_object_or_404(models.Member, id=data['member_id'])
            user = getattr(member, 'user', None)

            training1 = models.Training.objects.filter(user=user, session=session)
            training2 = models.Training.objects.filter(member_id=member.id, session=session)
            if (user and training1.exists()) or training2.exists():
                raise exceptions.ValidationError(dict(non_field_errors='Already registered.'))

            self.update_cert(session, member, status)

            serializer.save(user=user, member_id=member.id, attendance_status=status)
        else:
            training = models.Training.objects.filter(user=user, session=session)
            if training.exists():
                raise exceptions.ValidationError('Already registered')
            if user == session.instructor:
                raise exceptions.ValidationError('You are teaching this session')
            if status == 'Waiting for payment' and session.cost == 0:
                status = 'Confirmed'
            serializer.save(user=user, attendance_status=status)

    def perform_update(self, serializer):
        session_id = self.request.data['session']
        status = self.request.data['attendance_status']
        session = get_object_or_404(models.Session, id=session_id)
        if status == 'Waiting for payment' and session.cost == 0:
            status = 'Confirmed'

        training = serializer.save(attendance_status=status)

        if training.user:
            member = training.user.member
        else:
            member = models.Member.objects.get(id=training.member_id)

        self.update_cert(session, member, status)


class TransactionViewSet(Base, List, Create, Retrieve, Update):
    permission_classes = [AllowMetadata | IsAuthenticated, IsObjOwnerOrAdmin]
    serializer_class = serializers.TransactionSerializer

    def get_queryset(self):
        queryset = models.Transaction.objects
        month = self.request.query_params.get('month', '')

        if self.action == 'list' and month:
            try:
                dt = datetime.datetime.strptime(month, '%Y-%m')
            except ValueError:
                raise exceptions.ValidationError(dict(month='Should be YYYY-MM.'))
            queryset = queryset.filter(date__year=dt.year)
            queryset = queryset.filter(date__month=dt.month)
            queryset = queryset.exclude(category='Memberships:Fake Months')
            return queryset.order_by('-date', '-id')
        elif self.action == 'list':
            queryset = queryset.exclude(report_type__isnull=True)
            queryset = queryset.exclude(report_type='')
            return queryset.order_by('-date', '-id')
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
        d = request.data.dict()
        if d:
            logger.info(str(d))
        return Response(200)


class DoorViewSet(viewsets.ViewSet, List):
    def list(self, request):
        auth_token = request.META.get('HTTP_AUTHORIZATION', '')
        if auth_token != 'Bearer ' + secrets.DOOR_API_TOKEN:
            raise exceptions.PermissionDenied()

        cards = models.Card.objects.filter(active_status='card_active')
        active_member_cards = {}

        for card in cards:
            if card.user:
                member = card.user.member
            else:
                member = models.Member.objects.get(id=card.member_id)
            if member.paused_date: continue

            active_member_cards[card.card_number] = '{} ({})'.format(
                member.first_name + ' ' + member.last_name[0],
                member.id,
            )

        return Response(active_member_cards)

    @action(detail=True, methods=['post'])
    def seen(self, request, pk=None):
        card = get_object_or_404(models.Card, card_number=pk)
        card.last_seen_at = utils.today_alberta_tz()
        card.save()

        if card.user:
            member = card.user.member
        else:
            member = models.Member.objects.get(id=card.member_id)
        t = utils.now_alberta_tz().strftime('%Y-%m-%d %H:%M:%S, %a %I:%M %p')
        logger.info('Time: {} - Name: {} {} ({})'.format(t, member.first_name, member.last_name, member.id))

        utils_stats.calc_card_scans()

        return Response(200)


class LockoutViewSet(viewsets.ViewSet, List):
    def list(self, request):
        auth_token = request.META.get('HTTP_AUTHORIZATION', '')
        if auth_token != 'Bearer ' + secrets.DOOR_API_TOKEN:
            raise exceptions.PermissionDenied()

        cards = models.Card.objects.filter(active_status='card_active')
        active_member_cards = {}

        for card in cards:
            member = get_object_or_404(models.Member, id=card.member_id)
            if member.paused_date: continue

            authorization = {}
            authorization['id'] = member.id
            authorization['name'] = member.first_name + ' ' + member.last_name
            authorization['common'] = bool(member.orientation_date or member.vetted_date)
            authorization['lathe'] = bool(member.lathe_cert_date) and authorization['common']
            authorization['mill'] = bool(member.mill_cert_date) and authorization['common']
            authorization['wood'] = bool(member.wood_cert_date) and authorization['common']
            authorization['wood2'] = bool(member.wood2_cert_date) and authorization['common']
            authorization['cnc'] = bool(member.cnc_cert_date) and authorization['common']

            active_member_cards[card.card_number] = authorization

        return Response(active_member_cards)


class IpnView(views.APIView):
    def post(self, request):
        try:
            utils_paypal.process_paypal_ipn(request.data)
        except BaseException as e:
            logger.error('IPN route - {} - {}'.format(e.__class__.__name__, str(e)))
        finally:
            return Response(200)


class StatsViewSet(viewsets.ViewSet, List):
    def list(self, request):
        stats_keys = utils_stats.DEFAULTS.keys()
        cached_stats = cache.get_many(stats_keys)
        stats = utils_stats.DEFAULTS.copy()
        stats.update(cached_stats)

        user = self.request.user
        if not user.is_authenticated or not user.member.vetted_date:
            stats.pop('alarm', None)

        return Response(stats)

    @action(detail=False, methods=['post'])
    def bay_108_temp(self, request):
        try:
            cache.set('bay_108_temp', round(float(request.data['data']), 1))
            return Response(200)
        except ValueError:
            raise exceptions.ValidationError(dict(data='Invalid float.'))
        except KeyError:
            raise exceptions.ValidationError(dict(data='This field is required.'))

    @action(detail=False, methods=['post'])
    def bay_110_temp(self, request):
        try:
            cache.set('bay_110_temp', round(float(request.data['data']), 1))
            return Response(200)
        except ValueError:
            raise exceptions.ValidationError(dict(data='Invalid float.'))
        except KeyError:
            raise exceptions.ValidationError(dict(data='This field is required.'))

    @action(detail=False, methods=['post'])
    def alarm(self, request):
        try:
            alarm = dict(time=time.time(), data=int(request.data['data']))
            cache.set('alarm', alarm)
            return Response(200)
        except ValueError:
            raise exceptions.ValidationError(dict(data='Invalid integer.'))
        except KeyError:
            raise exceptions.ValidationError(dict(data='This field is required.'))

    @action(detail=False, methods=['post'])
    def track(self, request):
        if 'name' not in request.data:
            raise exceptions.ValidationError(dict(name='This field is required.'))

        if 'username' not in request.data:
            raise exceptions.ValidationError(dict(username='This field is required.'))

        track = cache.get('track', {})

        devicename = request.data['name']
        username = request.data['username']
        first_name = username.split('.')[0].title()

        track[devicename] = dict(time=time.time(), username=first_name)
        cache.set('track', track)

        ## update device usage
        ## issue: sometimes two sessions are created
        ## issue: sometimes two /track/ requests are sent and double time is counted
        #last_session = models.UsageTrack.objects.filter(devicename=devicename).last()
        #if not last_session or last_session.username != username:
        #    try:
        #        user = User.objects.get(username__iexact=username)
        #    except User.DoesNotExist:
        #        msg = 'Device tracker problem finding username: ' + username
        #        utils.alert_tanner(msg)
        #        logger.error(msg)
        #        user = None

        #    models.UsageTrack.objects.create(
        #        user=user,
        #        username=username,
        #        devicename=devicename,
        #        num_seconds=0,
        #    )
        #    logging.info('New ' + devicename + ' session created for: ' + username)
        #else:
        #    last_session.num_seconds = F('num_seconds') + 10
        #    last_session.save(update_fields=['num_seconds'])

        return Response(200)


class MemberCountViewSet(Base, List):
    pagination_class = None
    queryset = models.StatsMemberCount.objects.all()
    serializer_class = serializers.MemberCountSerializer

class SignupCountViewSet(Base, List):
    pagination_class = None
    serializer_class = serializers.SignupCountSerializer

    def get_queryset(self):
        # have to use method as slicing breaks makemigrations
        return models.StatsSignupCount.objects.order_by('-month')[:16][::-1]

class SpaceActivityViewSet(Base, List):
    pagination_class = None
    queryset = models.StatsSpaceActivity.objects.all()
    serializer_class = serializers.SpaceActivitySerializer


class BackupView(views.APIView):
    def get(self, request):
        auth_token = request.META.get('HTTP_AUTHORIZATION', '')
        auth_token = auth_token.replace('Bearer ', '')

        backup_user = secrets.BACKUP_TOKENS.get(auth_token, None)

        if backup_user:
            logger.info('Backup user: ' + backup_user['name'])
            backup_path = cache.get(backup_user['cache_key'], None)

            if not backup_path:
                logger.error('Backup not found')
                raise Http404

            if str(now().date()) not in backup_path:
                # sanity check - make sure it's actually today's backup
                msg = 'Today\'s backup not ready yet'
                logger.error(msg)
                return Response(msg, status=503)

            backup_url = 'https://static.{}/backups/{}'.format(
                settings.PRODUCTION_HOST,
                backup_path,
            )
            cache.set(backup_user['name'], datetime.datetime.now())

            return redirect(backup_url)
        else:
            backup_stats = []
            for backup_user in secrets.BACKUP_TOKENS.values():
                download_time = cache.get(backup_user['name'], None)
                if download_time:
                    time_delta = datetime.datetime.now() - download_time
                    less_than_24h = bool(time_delta.days == 0)
                else:
                    less_than_24h = False
                backup_stats.append(dict(
                    backup_user=backup_user['name'],
                    download_time=download_time,
                    less_than_24h=less_than_24h,
                ))
            return Response(backup_stats)


class PasteView(views.APIView):
    permission_classes = [IsAuthenticatedOrReadOnly]

    def get(self, request):
        return Response(dict(paste=cache.get('paste', '')))

    def post(self, request):
        if 'paste' in request.data:
            cache.set('paste', request.data['paste'][:20000])
            return Response(dict(paste=cache.get('paste', '')))
        else:
            raise exceptions.ValidationError(dict(paste='This field is required.'))


class HistoryViewSet(Base, List, Retrieve):
    permission_classes = [AllowMetadata | IsAdmin]
    serializer_class = serializers.HistorySerializer

    def get_queryset(self):
        queryset = models.HistoryIndex.objects

        if 'exclude_system' in self.request.query_params:
            queryset = queryset.filter(is_system=False)

        return queryset.order_by('-history_date')[:50]


class VettingViewSet(Base, List):
    permission_classes = [AllowMetadata | IsAdmin]
    serializer_class = serializers.AdminMemberSerializer

    def get_queryset(self):
        queryset = models.Member.objects

        four_weeks_ago = utils.today_alberta_tz() - datetime.timedelta(days=28)
        queryset = queryset.filter(status__in=['Prepaid', 'Current', 'Due'])
        queryset = queryset.filter(paused_date__isnull=True)
        queryset = queryset.filter(vetted_date__isnull=True)
        queryset = queryset.filter(current_start_date__lte=four_weeks_ago)

        return queryset.order_by('-current_start_date')


class RegistrationView(RegisterView):
    serializer_class = serializers.MyRegisterSerializer

    def post(self, request):
        data = request.data.copy()
        data.pop('password1', None)
        data.pop('password2', None)
        logger.info(dict(data))

        return super().post(request)


class PasswordChangeView(PasswordChangeView):
    permission_classes = [AllowMetadata | IsAuthenticated]
    serializer_class = serializers.MyPasswordChangeSerializer

class PasswordResetView(PasswordResetView):
    serializer_class = serializers.MyPasswordResetSerializer

class PasswordResetConfirmView(PasswordResetConfirmView):
    serializer_class = serializers.MyPasswordResetConfirmSerializer

class SpaceportAuthView(LoginView):
    serializer_class = serializers.SpaceportAuthSerializer


@api_view()
def null_view(request, *args, **kwargs):
    raise Http404
