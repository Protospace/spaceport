import logging
logger = logging.getLogger(__name__)

from django.contrib.auth.models import User, Group
from django.shortcuts import get_object_or_404, redirect
from django.db import transaction
from django.db.models import Max, F, Count, Q, Sum
from django.db.utils import OperationalError
from django.http import HttpResponse, Http404, FileResponse, HttpResponseServerError
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
from dateutil import relativedelta
import icalendar
import datetime, time
import io
import csv
import xmltodict
import json

from . import models, serializers, utils, utils_paypal, utils_stats, utils_ldap, utils_email
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

NUM_RESULTS = 100


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
                fuzzy_results = process.extract(search, choices, limit=20, scorer=fuzz.token_set_ratio)
                results += [x[0] for x in fuzzy_results]

            # remove dupes, truncate list
            results = list(OrderedDict.fromkeys(results))[:20]

            result_ids = [search_strings[x] for x in results]
            result_objects = [queryset.get(id=x) for x in result_ids]

            queryset = result_objects
            logging.info('Search for: {}, results: {}'.format(search, len(queryset)))
        elif self.action == 'create':
            if sort == 'recently_vetted':
                queryset = queryset.filter(vetted_date__isnull=False)
                queryset = queryset.order_by('-vetted_date', '-id')
            elif sort == 'newest_active':
                queryset = queryset.filter(paused_date__isnull=True)
                queryset = queryset.order_by('-current_start_date', '-id')
            elif sort == 'newest_overall':
                queryset = queryset.order_by('-current_start_date', '-id')
            elif sort == 'oldest_active':
                queryset = queryset.filter(paused_date__isnull=True)
                queryset = queryset.order_by('application_date', 'id')
            elif sort == 'oldest_overall':
                queryset = queryset.filter(application_date__isnull=False)
                queryset = queryset.order_by('application_date', 'id')
            elif sort == 'recently_inactive':
                queryset = queryset.filter(paused_date__isnull=False)
                queryset = queryset.order_by('-paused_date')
            elif sort == 'is_director':
                queryset = queryset.filter(is_director=True)
                queryset = queryset.order_by('application_date', 'id')
            elif sort == 'is_admin':
                queryset = queryset.exclude(is_director=False, is_staff=False, user__is_staff=False)
                queryset = queryset.order_by('application_date', 'id')
            elif sort == 'is_instructor':
                queryset = queryset.filter(paused_date__isnull=True, is_instructor=True)
                queryset = queryset.order_by('application_date', 'id')
            elif sort == 'due':
                queryset = queryset.filter(status='Due')
                queryset = queryset.order_by('expire_date', 'id')
            elif sort == 'overdue':
                queryset = queryset.filter(status='Overdue')
                queryset = queryset.order_by('expire_date', 'id')
            elif sort == 'last_scanned':
                if self.request.user.member.allow_last_scanned:
                    queryset = queryset.filter(allow_last_scanned=True)
                    queryset = queryset.annotate(
                        last_scanned=Max('user__cards__last_seen'),
                    ).exclude(last_scanned__isnull=True).order_by('-last_scanned')
                else:
                    queryset = []
            elif sort == 'pinball_score':
                queryset = queryset.annotate(
                    pinball_score=Max('user__scores__score', filter=Q(user__scores__id__gte=6720)),
                ).exclude(pinball_score__isnull=True).order_by('-pinball_score')
            elif sort == 'storage':
                queryset = queryset.annotate(
                    storage_count=Count('user__storage'),
                ).exclude(storage_count=0).order_by('-storage_count', 'id')
            elif sort == 'everyone':
                queryset = queryset.annotate(
                    protocoin_sum=Sum('user__transactions__protocoin'),
                    tx_sum=Sum('user__transactions__amount'),
                ).order_by('-protocoin_sum', '-tx_sum', 'id')
            elif sort == 'best_looking':
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
        page = self.request.data.get('page', 0)
        queryset = self.get_queryset()
        total = len(queryset)

        start = int(page) * NUM_RESULTS - 80
        queryset = queryset[max(start,0):start+NUM_RESULTS]

        if self.request.user.member.vetted_date:
            serializer = serializers.VettedSearchSerializer(queryset, many=True)
        else:
            serializer = serializers.SearchSerializer(queryset, many=True)

        return Response({'seq': seq, 'results': serializer.data, 'total': total})

    @action(detail=False, methods=['get'], permission_classes=[])
    def discourse(self, request):
        # TODO: allow logged in users access? (use above vetted_date serializer check if so)
        auth_token = request.META.get('HTTP_AUTHORIZATION', '')
        if secrets.PROTOGRAM_API_TOKEN and auth_token != 'Bearer ' + secrets.PROTOGRAM_API_TOKEN:
            raise exceptions.PermissionDenied()

        try:
            discourse_username = request.query_params['discourse_username']
        except KeyError:
            raise exceptions.ValidationError(dict(discourse_username='This field is required.'))

        member = get_object_or_404(models.Member, discourse_username__iexact=discourse_username)
        serializer = serializers.VettedSearchSerializer(member)

        return Response(serializer.data)


class MemberViewSet(Base, Retrieve, Update):
    permission_classes = [AllowMetadata | IsAuthenticated, IsObjOwnerOrAdmin]
    queryset = models.Member.objects.all()

    def get_serializer_class(self):
        if is_admin_director(self.request.user):
            return serializers.AdminMemberSerializer
        else:
            return serializers.MemberSerializer

    def perform_update(self, serializer):
        member = serializer.save()
        utils.tally_membership_months(member)
        utils.gen_member_forms(member)

    @action(detail=True, methods=['post'])
    def pause(self, request, pk=None):
        if not is_admin_director(self.request.user):
            raise exceptions.PermissionDenied()
        member = self.get_object()
        member.status = 'Paused Member'
        member.paused_date = utils.today_alberta_tz()
        member.save()

        msg = 'Member has been paused: {} {}'.format(member.preferred_name, member.last_name)
        utils.alert_tanner(msg)
        logger.info(msg)
        return Response(200)

    @action(detail=True, methods=['post'])
    def unpause(self, request, pk=None):
        if not is_admin_director(self.request.user):
            raise exceptions.PermissionDenied()

        today = utils.today_alberta_tz()
        member = self.get_object()

        difference = utils.today_alberta_tz() - member.paused_date
        if difference.days > 370:  # give some leeway
            logging.info('Member has been away for %s days (since %s), unvetting...', difference.days, member.paused_date)
            member.vetted_date = None
            member.orientation_date = None
            member.lathe_cert_date = None
            member.mill_cert_date = None
            member.wood_cert_date = None
            member.wood2_cert_date = None
            member.tormach_cnc_cert_date = None
            member.precix_cnc_cert_date = None
            member.embroidery_cert_date = None
            member.rabbit_cert_date = None
            member.trotec_cert_date = None

        member.current_start_date = today
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


class CardViewSet(Base, Create, Retrieve, Update):
    permission_classes = [AllowMetadata | IsAdmin]
    queryset = models.Card.objects.all()
    serializer_class = serializers.CardSerializer

    def perform_create(self, serializer):
        serializer.save()
        utils_stats.changed_card()

    def perform_update(self, serializer):
        serializer.save()
        utils_stats.changed_card()


# TODO: return nested list of sessions, limited with Prefetch:
#       https://stackoverflow.com/a/58689019
class CourseViewSet(Base, List, Retrieve, Create, Update):
    permission_classes = [AllowMetadata | IsAuthenticatedOrReadOnly, IsAdminOrReadOnly | IsInstructorOrReadOnly]
    queryset = models.Course.objects.annotate(
        recent_date=Max('sessions__datetime'),
        num_interested=Count('interests', filter=Q(interests__satisfied_by__isnull=True), distinct=True),
    ).order_by(
        '-num_interested',
        '-recent_date',
    )

    def get_serializer_class(self):
        if self.action == 'list':
            return serializers.CourseListSerializer
        else:
            return serializers.CourseDetailSerializer


class SessionViewSet(Base, List, Retrieve, Create, Update):
    permission_classes = [AllowMetadata | IsAuthenticatedOrReadOnly, IsAdminOrReadOnly | IsInstructorOrReadOnly]

    def get_queryset(self):
        if self.action == 'list':
            week_ago = now() - datetime.timedelta(days=7)
            year_ago = now() - datetime.timedelta(days=365)

            return models.Session.objects.annotate(
                course_count=Count(
                    'course__sessions',
                    filter=Q(
                        course__sessions__datetime__gte=year_ago,
                    ),
                ),
            ).filter(
                datetime__gte=week_ago,
            ).order_by(
                '-course_count',
                '-course_id',
                'datetime',
            )
        else:
            return models.Session.objects.all()

    def get_serializer_class(self):
        if self.action == 'list':
            return serializers.SessionListSerializer
        else:
            return serializers.SessionSerializer

    def perform_create(self, serializer):
        data = self.request.data
        session = serializer.save(instructor=self.request.user)

        # ensure session datetime is at least 1 day in the future
        # before sending interest emails
        if session.datetime < now() + datetime.timedelta(days=1):
            logging.info('Session is in the past or too soon, not sending interest emails.')
            return

        interests = models.Interest.objects.filter(
            course=session.course,
            satisfied_by__isnull=True,
            user__member__paused_date__isnull=True
        )[:20]

        for num, interest in enumerate(interests):
            msg = 'Sending email {} / {}...'.format(num+1, len(interests))
            if data['request_id']: utils_stats.set_progress(data['request_id'], msg, replace=True)

            try:
                utils_email.send_interest_email(interest)
            except BaseException as e:
                msg = 'Problem sending interest email: ' + str(e)
                logger.exception(msg)
                utils.alert_tanner(msg)

        interest_ids = interests.values('id')
        num_satisfied = models.Interest.objects.filter(id__in=interest_ids).update(satisfied_by=session)

        logging.info('Satisfied %s interests.', num_satisfied)

    def generate_ical(self, session):
        cal = icalendar.Calendar()
        cal.add('prodid', '-//Protospace//Spaceport//')
        cal.add('version', '2.0')

        event = icalendar.Event()
        event.add('summary', session.course.name)
        event.add('dtstart', session.datetime)
        event.add('dtend', session.datetime + datetime.timedelta(hours=1))
        event.add('dtstamp', now())

        cal.add_component(event)

        return cal.to_ical()

    @action(detail=True, methods=['get'])
    def download_ical(self, request, pk=None):
        session = get_object_or_404(models.Session, id=pk)
        user = self.request.user

        ical_file = self.generate_ical(session).decode()

        response = FileResponse(ical_file, filename='event.ics')
        response['Content-Type'] = 'text/calendar'
        response['Content-Disposition'] = 'attachment; filename="event.ics"'

        return response

    @action(detail=True, methods=['post'], permission_classes=[AllowMetadata | IsAuthenticated])
    def email_ical(self, request, pk=None):
        session = get_object_or_404(models.Session, id=pk)
        user = self.request.user

        ical_file = self.generate_ical(session).decode()

        utils_email.send_ical_email(user.member, session, ical_file)

        return Response(200)

    @action(detail=False, methods=['get'])
    def all(self, request):
        sessions = models.Session.objects.order_by('datetime')
        serializer = serializers.SessionListSerializer(sessions, many=True)

        result = {
            "count": sessions.count(),
            "next": None,
            "previous": None,
            "results": serializer.data,
        }
        return Response(result)


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
        def check_attendance(requires_vetted=False):
            if requires_vetted:
                if status == 'Attended' and member.vetted_date:
                    logging.info('Granting certification: %s', session.course.name)
                    return utils.today_alberta_tz()
            else:
                if status == 'Attended':
                    logging.info('Granting certification: %s', session.course.name)
                    return utils.today_alberta_tz()

            logging.info('Not granting certification: %s', session.course.name)
            return None

        # always update cert date incase member is returning and gets recertified
        if session.course.id == 249:
            member.orientation_date = check_attendance()
        elif session.course.id in [463, 261]:
            member.wood_cert_date = check_attendance()
        elif session.course.id == 401:
            member.wood2_cert_date = check_attendance()
        elif session.course.id == 281:
            member.lathe_cert_date = check_attendance()
        elif session.course.id == 283:
            member.mill_cert_date = check_attendance()
        elif session.course.id == 259:
            member.tormach_cnc_cert_date = check_attendance()
        elif session.course.id == 428:
            member.precix_cnc_cert_date = check_attendance(requires_vetted=True)

            if utils_ldap.is_configured():
                if member.precix_cnc_cert_date:
                    utils_ldap.add_to_group(member, 'CNC-Precix-Users')
                else:
                    utils_ldap.remove_from_group(member, 'CNC-Precix-Users')
        elif session.course.id == 247:
            member.rabbit_cert_date = check_attendance(requires_vetted=True)

            if utils_ldap.is_configured():
                if member.rabbit_cert_date:
                    utils_ldap.add_to_group(member, 'Laser Users')
                else:
                    utils_ldap.remove_from_group(member, 'Laser Users')
        elif session.course.id == 321:
            member.trotec_cert_date = check_attendance(requires_vetted=True)

            if utils_ldap.is_configured():
                if member.trotec_cert_date:
                    utils_ldap.add_to_group(member, 'Trotec Users')
                else:
                    utils_ldap.remove_from_group(member, 'Trotec Users')
        elif session.course.id == 447:
            member.embroidery_cert_date = check_attendance()

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
                raise exceptions.ValidationError(dict(non_field_errors='Not allowed to register others'))

            member = get_object_or_404(models.Member, id=data['member_id'])
            user = member.user
            course_id = session.course.id

            if course_id not in [317, 273, 413] and user == session.instructor:
                msg = 'Self-register trickery detected:\n' + str(data.dict())
                utils.alert_tanner(msg)
                raise exceptions.ValidationError(dict(non_field_errors='Can\'t register the instructor. Don\'t try to trick the portal.'))

            training1 = models.Training.objects.filter(user=user, session=session)
            if training1.exists():
                raise exceptions.ValidationError(dict(non_field_errors='Already registered, refresh the page'))

            self.update_cert(session, member, status)

            serializer.save(user=user, attendance_status=status)
        else:
            training = models.Training.objects.filter(user=user, session=session)

            if training.exists():
                raise exceptions.ValidationError(dict(non_field_errors='Already registered, refresh the page'))
            if user == session.instructor:
                raise exceptions.ValidationError(dict(non_field_errors='You are teaching this session'))

            if status == 'Waiting for payment' and session.cost == 0:
                status = 'Confirmed'

            serializer.save(user=user, attendance_status=status)

    def perform_update(self, serializer):
        user = self.request.user
        data = self.request.data
        session_id = data['session']
        status = data['attendance_status']
        session = get_object_or_404(models.Session, id=session_id)

        if status == 'Waiting for payment' and session.cost == 0:
            status = 'Confirmed'

        if (
            status == 'Withdrawn'
            and 'Protospace' not in session.course.tags
            and 'Event' not in session.course.tags
            and 'Outing' not in session.course.tags
            and now() + datetime.timedelta(days=1) > session.datetime
            and not ((is_admin_director(user) or session.instructor == user) and 'student_id' in data)
        ):
            raise exceptions.ValidationError(dict(non_field_errors='Can\'t withdraw 24h before class or after. Contact instructor.'))

        training = serializer.save(attendance_status=status)
        member = training.user.member

        if (is_admin_director(user) or session.instructor == user) and 'student_id' in data:
            logging.info('Updating cert...')
            self.update_cert(session, member, status)


class QuizViewSet(Base):
    permission_classes = [AllowMetadata | IsAuthenticated]

    @action(detail=True, methods=['post'])
    def submit(self, request, pk):
        quiz = pk
        data = request.data
        user = request.user
        member = user.member

        if quiz not in ['sawstop']:
            raise exceptions.ValidationError(dict(non_field_errors='Unknown quiz.'))

        if quiz == 'sawstop' and member.wood_cert_date:
            raise exceptions.ValidationError(dict(non_field_errors='Already certified.'))

        # TODO: check if cert requires vetting?

        WOOD1_COURSE = 261
        attended_wood1 = models.Training.objects.filter(user=user, session__course__id=WOOD1_COURSE, attendance_status='Attended').exists()

        NMO_COURSE = 249
        attended_nmo = models.Training.objects.filter(user=user, session__course__id=NMO_COURSE, attendance_status='Attended').exists()

        if quiz == 'sawstop' and not attended_nmo:
            raise exceptions.ValidationError(dict(non_field_errors='You haven\'t attended a New Member Orientation yet.'))

        if quiz == 'sawstop' and not attended_wood1:
            raise exceptions.ValidationError(dict(non_field_errors='You haven\'t attended a Wood I class yet.'))

        if quiz == 'sawstop' and data.dict() != {'agree1': 'true', 'agree2': 'true', 'agree3': 'true', 'material1': 'true', 'material2': 'false', 'material3': 'true', 'material4': 'true', 'material5': 'true', 'material6': 'true', 'material7': 'true', 'bypass1': 'false', 'bypass2': 'false', 'bypass3': 'true', 'bypass4': 'true', 'bypass5': 'true', 'tested1': 'true', 'tested2': 'false', 'tested3': 'false', 'tested4': 'false', 'tested5': 'true', 'tested6': 'true', 'never1': 'false', 'never2': 'true', 'never3': 'false', 'never4': 'true', 'never5': 'true', 'never6': 'false', 'led1': 'true', 'led2': 'false', 'led3': 'false', 'spin1': 'false', 'spin2': 'true', 'spin3': 'false', 'spin4': 'false', 'tape1': 'true', 'tape2': 'false'}:
            raise exceptions.ValidationError(dict(non_field_errors='At least one answer is incorrect.'))

        logging.info('Granting quiz certification: %s', quiz)

        if quiz == 'sawstop':
            member.wood_cert_date = utils.today_alberta_tz()
            member.save()

        return Response(200)


class TransactionViewSet(Base, List, Create, Retrieve, Update):
    permission_classes = [AllowMetadata | IsAuthenticated, IsObjOwnerOrAdmin]
    serializer_class = serializers.TransactionSerializer

    def get_queryset(self):
        queryset = models.Transaction.objects
        month = self.request.query_params.get('month', '')
        date = self.request.query_params.get('date', '')
        member_id = self.request.query_params.get('member_id', '')
        exclude_paypal = self.request.query_params.get('exclude_paypal', '') == 'true'
        exclude_snacks = self.request.query_params.get('exclude_snacks', '') == 'true'
        exclude_dues = self.request.query_params.get('exclude_dues', '') == 'true'

        if self.action == 'list':
            if month:
                try:
                    dt = datetime.datetime.strptime(month, '%Y-%m')
                except ValueError:
                    raise exceptions.ValidationError(dict(month='Should be YYYY-MM.'))
                queryset = queryset.filter(date__year=dt.year)
                queryset = queryset.filter(date__month=dt.month)
                queryset = queryset.exclude(category='Memberships:Fake Months')
            elif date:
                try:
                    dt = datetime.datetime.strptime(date, '%Y-%m-%d')
                except ValueError:
                    raise exceptions.ValidationError(dict(date='Should be YYYY-MM-DD.'))
                queryset = queryset.filter(date__year=dt.year)
                queryset = queryset.filter(date__month=dt.month)
                queryset = queryset.filter(date__day=dt.day)
                queryset = queryset.exclude(category='Memberships:Fake Months')
            else:
                queryset = queryset.exclude(report_type__isnull=True)
                queryset = queryset.exclude(report_type='')

            if member_id:
                queryset = queryset.filter(user__member__id=member_id)

            if exclude_paypal:
                queryset = queryset.exclude(account_type='PayPal')

            if exclude_snacks:
                queryset = queryset.exclude(category='Snacks')

            if exclude_dues:
                queryset = queryset.exclude(category='Membership')
            return queryset.order_by('-date', '-id')
        else:
            return queryset.all()

    def retally_membership(self):
        member_id = self.request.data['member_id']
        member = get_object_or_404(models.Member, id=member_id)
        utils.tally_membership_months(member)

    def train_paypal_hint(self, tx):
        if tx.paypal_subscr_id:
            models.PayPalHint.objects.update_or_create(
                account=tx.paypal_subscr_id,
                defaults=dict(user=tx.user),
            )

        if tx.paypal_payer_id:
            models.PayPalHint.objects.update_or_create(
                account=tx.paypal_payer_id,
                defaults=dict(user=tx.user),
            )

    def perform_create(self, serializer):
        tx = serializer.save(recorder=self.request.user)
        utils.log_transaction(tx)
        self.retally_membership()

    def perform_update(self, serializer):
        tx = serializer.save()
        utils.log_transaction(tx)
        self.retally_membership()
        self.train_paypal_hint(tx)

    def list(self, request):
        if not is_admin_director(self.request.user):
            raise exceptions.PermissionDenied()
        return super().list(request)

    @action(detail=False, methods=['get'])
    def summary(self, request):
        txs = models.Transaction.objects
        month = self.request.query_params.get('month', '')

        try:
            dt = datetime.datetime.strptime(month, '%Y-%m')
        except ValueError:
            raise exceptions.ValidationError(dict(month='Should be YYYY-MM.'))

        txs = txs.filter(date__year=dt.year)
        txs = txs.filter(date__month=dt.month)
        txs = txs.exclude(category='Memberships:Fake Months')

        result = []

        for category in ['Membership', 'Snacks', 'OnAcct', 'Donation', 'Consumables', 'Purchases']:
            result.append(dict(
                category = category,
                dollar = txs.filter(category=category).aggregate(Sum('amount'))['amount__sum'] or 0,
                protocoin = -1 * (txs.filter(category=category).aggregate(Sum('protocoin'))['protocoin__sum'] or 0),
            ))

        return Response(result)


class UserView(views.APIView):
    permission_classes = [AllowMetadata | IsAuthenticated]

    def get(self, request):
        serializer = serializers.UserSerializer(request.user)
        return Response(serializer.data)


class PingView(views.APIView):
    permission_classes = [AllowMetadata | IsAuthenticated]

    def post(self, request):
        return Response(dict(app_version=settings.APP_VERSION))


class DoorViewSet(viewsets.ViewSet, List):
    def list(self, request):
        auth_token = request.META.get('HTTP_AUTHORIZATION', '')
        if secrets.DOOR_API_TOKEN and auth_token != 'Bearer ' + secrets.DOOR_API_TOKEN:
            raise exceptions.PermissionDenied()

        cards = models.Card.objects.filter(active_status='card_active')
        active_member_cards = {}

        for card in cards:
            member = card.user.member
            if member.paused_date: continue
            if not member.vetted_date: continue
            if not member.is_allowed_entry: continue

            active_member_cards[card.card_number] = '{} ({})'.format(
                member.preferred_name + ' ' + member.last_name[0],
                member.id,
            )

        return Response(active_member_cards)

    @action(detail=True, methods=['post'])
    def seen(self, request, pk=None):
        card = get_object_or_404(models.Card, card_number=pk)
        card.last_seen = now()
        card.save()

        member = card.user.member
        t = utils.now_alberta_tz().strftime('%Y-%m-%d %H:%M:%S, %a %I:%M %p')
        logger.info('Scan - Time: {} | Name: {} {} ({})'.format(t, member.preferred_name, member.last_name, member.id))

        last_scan = dict(
            time=time.time(),
            member_id=member.id,
            first_name=member.preferred_name,
        )
        cache.set('last_scan', last_scan)

        utils_stats.calc_card_scans()

        utils.mqtt_publish('spaceport/door/scan', json.dumps(last_scan))

        return Response(200)


class LockoutViewSet(viewsets.ViewSet, List):
    def list(self, request):
        auth_token = request.META.get('HTTP_AUTHORIZATION', '')
        if secrets.DOOR_API_TOKEN and auth_token != 'Bearer ' + secrets.DOOR_API_TOKEN:
            raise exceptions.PermissionDenied()

        cards = models.Card.objects.filter(active_status='card_active')
        active_member_cards = {}

        for card in cards:
            member = card.user.member
            if member.paused_date: continue
            if not member.is_allowed_entry: continue

            authorization = {}
            authorization['id'] = member.id
            authorization['name'] = member.preferred_name + ' ' + member.last_name
            authorization['common'] = bool(member.orientation_date or member.vetted_date)
            authorization['lathe'] = bool(member.lathe_cert_date) and authorization['common']
            authorization['mill'] = bool(member.mill_cert_date) and authorization['common']
            authorization['wood'] = bool(member.wood_cert_date) and authorization['common']
            authorization['wood2'] = bool(member.wood2_cert_date) and authorization['common']
            authorization['cnc'] = bool(member.tormach_cnc_cert_date) and authorization['common']
            authorization['tormach_cnc'] = bool(member.tormach_cnc_cert_date) and authorization['common']
            authorization['precix_cnc'] = bool(member.precix_cnc_cert_date) and authorization['common']
            authorization['embroidery'] = bool(member.embroidery_cert_date) and authorization['common']

            active_member_cards[card.card_number] = authorization

        return Response(active_member_cards)


class IpnView(views.APIView):
    def post(self, request):
        try:
            utils_paypal.process_paypal_ipn(request.data)
        except BaseException as e:
            logger.exception('IPN route - {} - {}'.format(e.__class__.__name__, str(e)))
            return HttpResponseServerError()

        return Response(200)


class StatsViewSet(viewsets.ViewSet, List):
    def list(self, request):
        stats_keys = utils_stats.DEFAULTS.keys()
        cached_stats = cache.get_many(stats_keys)
        stats = utils_stats.DEFAULTS.copy()
        stats.update(cached_stats)

        user = self.request.user
        if not user.is_authenticated:
            stats.pop('alarm', None)
            stats.pop('autoscan', None)

        stats['at_protospace'] = utils.is_request_from_protospace(request)

        return Response(stats)

    @action(detail=False, methods=['get'])
    def progress(self, request):
        try:
            request_id = request.query_params['request_id']
            return Response(utils_stats.get_progress(request_id))
        except KeyError:
            raise exceptions.ValidationError(dict(request_id='This field is required.'))

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
    def sign(self, request):
        try:
            sign = request.data['sign'][:500]

            sign = sign.replace('‘', '\'').replace('’', '\'')
            sign = sign.replace('“', '"').replace('”', '"')
            sign = sign.replace('…', '...')

            if sign.startswith('https://') or sign.startswith('http://'):
                cache.set('link', sign)
            else:
                cache.set('sign', sign)

            return Response(200)
        except KeyError:
            raise exceptions.ValidationError(dict(sign='This field is required.'))

    @action(detail=False, methods=['post'])
    def alarm(self, request):
        # Sample messages:
        # {'data': 'Connected'}
        # {'data': 'Trouble status on'}
        # {'data': 'Exit delay in progress: Partition 1'}
        # {'data': 'Disarmed: Partition 1'}
        # {'data': 'Armed away: Partition 1'}
        # {'data': 'Alarm: Partition 1'}
        # {'data': 'Alarm: Partition 2'}
        # {'data': 'Zone alarm restored: 1'}
        # {'data': 'Zone alarm restored: 3'}
        # {'data': 'Disarmed: Partition 1'}
        # {'data': 'Disarmed: Partition 2'}

        auth_token = request.META.get('HTTP_AUTHORIZATION', '')
        if secrets.ALARM_API_TOKEN and auth_token != 'Bearer ' + secrets.ALARM_API_TOKEN:
            raise exceptions.PermissionDenied()

        try:
            data = str(request.data['data'])
        except KeyError:
            raise exceptions.ValidationError(dict(data='This field is required.'))

        logging.info('Alarm data: %s', data)

        state = None
        if data.startswith('Armed'):
            state = 'Armed'
        elif data.startswith('Disarmed'):
            state = 'Disarmed'
        elif data.startswith('Exit delay in progress'):
            state = 'Exit delay'
        elif data.startswith('Alarm'):
            state = 'TRIGGERED!'

        if state:
            logging.info('Setting alarm status to: %s', state)
            alarm = dict(time=time.time(), data=state)
            cache.set('alarm', alarm)

        return Response(200)

    @action(detail=False, methods=['post'])
    def track(self, request):
        if 'name' not in request.data:
            raise exceptions.ValidationError(dict(name='This field is required.'))

        if 'username' not in request.data:
            raise exceptions.ValidationError(dict(username='This field is required.'))

        track = cache.get('track', {})

        devicename = request.data['name']
        username = request.data['username'].lower()
        first_name = username.split('.')[0].title()

        track[devicename] = dict(
            time=time.time(),
            username=username,
            first_name=first_name,
        )
        cache.set('track', track)

        return Response(200)

    # TODO: keep track of last report to ensure PS internet didn't cut out
    # TODO: get rid of username request.data check
    # TODO: only create one object when username's not valid, move check up
    @action(detail=False, methods=['post'])
    def usage(self, request):
        if 'device' not in request.data:
            raise exceptions.ValidationError(dict(device='This field is required.'))

        device = request.data['device']
        data = request.data.get('data', None)

        username_isfrom_track = False

        if 'username' in request.data:
            username = request.data['username']
        else:
            track = cache.get('track', {})
            try:
                username = track[device]['username']
                username_isfrom_track = True
            except KeyError:
                msg = 'Usage tracker problem finding username for device: {}'.format(device)
                #utils.alert_tanner(msg)
                logger.error(msg)
                username = ''
                return Response(200)

        logging.debug('Device %s data: %s', device, data)

        if device == 'TROTECS300' and data and int(data) > 3:
            should_count = True
        else:
            should_count = False

        last_use = models.Usage.objects.filter(
            device=device,
            deleted_at__isnull=True,
        ).last()

        if should_count:
            start_new_use = not last_use or last_use.finished_at or last_use.username != username
            if start_new_use:
                username_isexpired = time.time() - track[device]['time'] > 2*60*60  # two hours
                if username_isfrom_track and username_isexpired:
                    msg = 'Usage tracker problem expired username {} for device: {}'.format(username, device)
                    #utils.alert_tanner(msg)
                    logger.error(msg)
                    username = ''
                    return Response(200)

                try:
                    user = User.objects.get(username__iexact=username)
                except User.DoesNotExist:
                    msg = 'Usage tracker problem finding user for username: {}'.format(username or '[no username]')
                    #utils.alert_tanner(msg)
                    logger.error(msg)
                    user = None
                    return Response(200)

                last_use = models.Usage.objects.create(
                    user=user,
                    username=username,
                    device=device,
                    num_reports=0,
                    memo='',
                    finished_at=None,
                    num_seconds=0,
                )
                logging.info('New %s usage #%s created for: %s', device, last_use.id, username or '[no username]')
        else:
            if last_use and not last_use.finished_at:
                time_now = now()
                duration = time_now - last_use.started_at
                logging.info('Finishing %s usage #%s, duration: %s', device, last_use.id, duration)
                last_use.finished_at = time_now
                last_use.num_seconds = duration.seconds
                last_use.save()

        return Response(200)

    @action(detail=False, methods=['get'])
    def usage_data(self, request):
        if 'device' not in request.query_params:
            raise exceptions.ValidationError(dict(device='This field is required.'))

        if not (
            is_admin_director(self.request.user) or
            utils.is_request_from_protospace(request)
        ):
            raise exceptions.PermissionDenied()

        device = request.query_params['device']
        device_uses = models.Usage.objects.filter(device=device)

        last_use = device_uses.last()

        if not last_use:
            raise exceptions.ValidationError(dict(device='Session not found.'))

        last_use_id = last_use.id
        user = last_use.user

        last_use_different_user = device_uses.exclude(
            user=user,
        ).last()

        if last_use_different_user:
            last_different_id = last_use_different_user.id
        else:
            last_different_id = -1

        session_uses = device_uses.filter(id__gt=last_different_id)

        time_now = now()
        session_time = (time_now - session_uses.first().started_at).seconds

        if last_use.finished_at:
            last_use_time = last_use.num_seconds
            running_cut_time = 0
        else:
            last_use_time = (time_now - last_use.started_at).seconds
            running_cut_time = last_use_time

        today_start = utils.now_alberta_tz().replace(hour=0, minute=0, second=0)
        month_start = today_start.replace(day=1)

        today_total = device_uses.filter(
            user=user, started_at__gte=today_start, should_bill=True,
        ).aggregate(Sum('num_seconds'))['num_seconds__sum'] or 0

        month_total = device_uses.filter(
            user=user, started_at__gte=month_start, should_bill=True,
        ).aggregate(Sum('num_seconds'))['num_seconds__sum'] or 0

        today_total += running_cut_time
        month_total += running_cut_time

        try:
            track = cache.get('track', {})[device]
        except KeyError:
            track = False

        if last_use.user:
            username = last_use.user.username
            first_name = last_use.user.member.preferred_name
        else:
            username = last_use.username
            first_name = username.split('.')[0].title()

        return Response(dict(
            username=username,
            first_name=first_name,
            track=track,
            session_time=session_time,
            last_use_time=last_use_time,
            last_use_id=last_use_id,
            today_total=today_total,
            month_total=month_total,
        ))

    @action(detail=False, methods=['post'])
    def autoscan(self, request):
        if 'autoscan' not in request.data:
            raise exceptions.ValidationError(dict(autoscan='This field is required.'))

        cache.set('autoscan', request.data['autoscan'])
        return Response(200)

    @action(detail=False, methods=['post'])
    def garden(self, request):
        if 'photo' not in request.data:
            raise exceptions.ValidationError(dict(photo='This field is required.'))

        photo = request.data['photo']
        medium, large = utils.process_garden_image(photo)

        logging.debug('Wrote garden images to %s and %s', medium, large)

        return Response(200)

    @action(detail=True, methods=['post'])
    def printer3d(self, request, pk=None):
        printer3d = cache.get('printer3d', {})
        devicename = pk

        if devicename.startswith('ord'):
            status = request.data['result']['status']
            printer3d[devicename] = dict(
                progress=int(status['display_status']['progress'] * 100),
                #filename=status['print_stats']['filename'],
                state=status['idle_timeout']['state'],
            )
        elif devicename.startswith('p1s'):
            printer3d[devicename] = request.data

        cache.set('printer3d', printer3d)

        return Response(200)



class MemberCountViewSet(Base, List):
    pagination_class = None
    queryset = models.StatsMemberCount.objects.all()
    serializer_class = serializers.MemberCountSerializer

class SignupCountViewSet(Base, List):
    pagination_class = None
    queryset = models.StatsSignupCount.objects.all()
    serializer_class = serializers.SignupCountSerializer

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
            logger.info('Backup - User: ' + backup_user['name'])
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
        elif auth_token:
            raise exceptions.PermissionDenied()
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
        if request.user.id == 9:
            key = 'special_paste'
            logging.info('Using special paste for a special someone.')
        else:
            key = 'paste'

        return Response(dict(paste=cache.get(key, '')))

    def post(self, request):
        if 'paste' in request.data:
            if request.user.id == 9:
                key = 'special_paste'
                logging.info('Using special paste for a special someone.')
            else:
                key = 'paste'
            cache.set(key, request.data['paste'][:20000])
            return Response(dict(paste=cache.get(key, '')))
        else:
            raise exceptions.ValidationError(dict(paste='This field is required.'))


class HistoryViewSet(Base, List, Retrieve):
    permission_classes = [AllowMetadata | IsAdmin]
    serializer_class = serializers.HistorySerializer

    def get_queryset(self):
        queryset = models.HistoryIndex.objects

        exclude_system = self.request.query_params.get('exclude_system', '') == 'true'
        member_id = self.request.query_params.get('member_id', '')

        if exclude_system:
            queryset = queryset.filter(is_system=False)

        if member_id:
            queryset = queryset.filter(owner_id=member_id)

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

        return queryset.order_by('-current_start_date', '-id')


class UsageViewSet(Base):
    permission_classes = [AllowMetadata | IsAdmin]

    # TODO: add filtering by device
    @action(detail=False, methods=['get'])
    def csv(self, request):
        usages = models.Usage.objects.order_by('id').filter(should_bill=True)

        month = self.request.query_params.get('month', None)
        if month:
            try:
                dt = datetime.datetime.strptime(month, '%Y-%m')
                dt = utils.TIMEZONE_CALGARY.localize(dt)
            except ValueError:
                raise exceptions.ValidationError(dict(month='Should be YYYY-MM.'))

            usages = usages.filter(
                started_at__gte=dt,
                started_at__lt=dt + relativedelta.relativedelta(months=1),
            )

        response = HttpResponse(
            content_type='text/csv',
        )
        response['Content-Disposition'] = 'attachment; filename="usage-{}.csv"'.format(month or 'all')

        fieldnames = ['id', 'user__username', 'device', 'started_at', 'finished_at', 'num_seconds']
        writer = csv.DictWriter(response, fieldnames=fieldnames)

        writer.writeheader()
        for u in usages.values(*fieldnames):
            u['started_at'] = u['started_at'].astimezone(utils.TIMEZONE_CALGARY)
            if u['finished_at']:
                u['finished_at'] = u['finished_at'].astimezone(utils.TIMEZONE_CALGARY)
            writer.writerow(u)

        return response


class InterestViewSet(Base, Retrieve, Create):
    permission_classes = [AllowMetadata | IsAuthenticated]
    queryset = models.Interest.objects.all()
    serializer_class = serializers.InterestSerializer

    def perform_create(self, serializer):
        user = self.request.user
        course = self.request.data['course']

        interest = models.Interest.objects.filter(user=user, course=course, satisfied_by__isnull=True)
        if interest.exists():
            raise exceptions.ValidationError(dict(non_field_errors='Already interested'))

        serializer.save(
            user=user,
            satisfied_by=None
        )


class ProtocoinViewSet(Base):
    @action(detail=False, methods=['post'], permission_classes=[AllowMetadata | IsAuthenticated])
    def spend_request(self, request):
        try:
            with transaction.atomic():
                source_user = self.request.user
                source_member = source_user.member

                training = None

                try:
                    balance = float(request.data['balance'])
                except KeyError:
                    raise exceptions.ValidationError(dict(balance='This field is required.'))
                except ValueError:
                    raise exceptions.ValidationError(dict(balance='Invalid number.'))

                try:
                    amount = float(request.data['amount'])
                except KeyError:
                    raise exceptions.ValidationError(dict(amount='This field is required.'))
                except ValueError:
                    raise exceptions.ValidationError(dict(amount='Invalid number.'))

                try:
                    category = str(request.data['category'])
                except KeyError:
                    raise exceptions.ValidationError(dict(category='This field is required.'))
                if category not in ['Consumables', 'Donation', 'OnAcct']:
                    raise exceptions.ValidationError(dict(category='Invalid category.'))

                if category == 'OnAcct':
                    try:
                        training_id = int(request.data['training'])
                    except KeyError:
                        raise exceptions.ValidationError(dict(training='This field is required.'))
                    except ValueError:
                        raise exceptions.ValidationError(dict(training='Invalid number.'))

                    training = get_object_or_404(models.Training, id=training_id)

                    if not training.session:
                        raise exceptions.ValidationError(dict(training='Invalid session.'))

                    if training.session.is_cancelled:
                        raise exceptions.ValidationError(dict(training='Class is cancelled.'))

                    if training.paid_date:
                        raise exceptions.ValidationError(dict(training='Already paid.'))

                    if training.session.cost != amount:
                        msg = 'Protocoin training payment amount mismatch:\n' + str(request.data.dict())
                        utils.alert_tanner(msg)
                        raise exceptions.ValidationError(dict(training='Class cost doesn\'t match amount.'))

                memo = str(request.data.get('memo', ''))

                # also prevents negative spending
                if amount < 0.25:
                    raise exceptions.ValidationError(dict(amount='Amount too small.'))

                source_user_balance = source_user.transactions.aggregate(Sum('protocoin'))['protocoin__sum'] or 0
                source_user_balance = float(source_user_balance)

                if abs(source_user_balance - balance) > 0.01:  # stupid https://docs.djangoproject.com/en/4.2/ref/databases/#decimal-handling
                    raise exceptions.ValidationError(dict(balance='Incorrect current balance. Try refreshing the page.'))

                if source_user_balance < amount:
                    raise exceptions.ValidationError(dict(amount='Insufficient funds.'))

                if training:
                    tx_memo = 'Protocoin - Transaction spent ₱ {} on {}, session: {}, training: {}'.format(
                        amount,
                        training.session.course.name,
                        str(training.session.id),
                        str(training.id),
                    )
                else:
                    tx_memo = 'Protocoin - Transaction spent ₱ {} on {}{}'.format(
                        amount,
                        category,
                        ', memo: ' + memo if memo else ''
                    )

                tx = models.Transaction.objects.create(
                    user=source_user,
                    protocoin=-amount,
                    amount=0,
                    number_of_membership_months=0,
                    account_type='Protocoin',
                    category=category,
                    info_source='System',
                    memo=tx_memo,
                )
                utils.log_transaction(tx)

                if training:
                    if training.attendance_status == 'Waiting for payment':
                        training.attendance_status = 'Confirmed'
                    training.paid_date = utils.today_alberta_tz()
                    training.save()

                return Response(200)
        except OperationalError:
            self.spend_request(request)

    @action(detail=False, methods=['post'], permission_classes=[AllowMetadata | IsAuthenticated])
    def send_to_member(self, request):
        try:
            with transaction.atomic():
                source_user = self.request.user
                source_member = source_user.member

                try:
                    member_id = int(request.data['member_id'])
                except KeyError:
                    raise exceptions.ValidationError(dict(member_id='This field is required.'))
                except ValueError:
                    raise exceptions.ValidationError(dict(member_id='Invalid number.'))

                try:
                    balance = float(request.data['balance'])
                except KeyError:
                    raise exceptions.ValidationError(dict(balance='This field is required.'))
                except ValueError:
                    raise exceptions.ValidationError(dict(balance='Invalid number.'))

                try:
                    amount = float(request.data['amount'])
                except KeyError:
                    raise exceptions.ValidationError(dict(amount='This field is required.'))
                except ValueError:
                    raise exceptions.ValidationError(dict(amount='Invalid number.'))

                # also prevents negative spending
                if amount < 1.00:
                    raise exceptions.ValidationError(dict(amount='Amount too small.'))


                if member_id == source_member.id:
                    raise exceptions.ValidationError(dict(member_id='Unable to send to self.'))

                destination_member = get_object_or_404(models.Member, id=member_id)
                destination_user = destination_member.user

                source_user_balance = source_user.transactions.aggregate(Sum('protocoin'))['protocoin__sum'] or 0
                source_user_balance = float(source_user_balance)

                if abs(source_user_balance - balance) > 0.01:  # stupid https://docs.djangoproject.com/en/4.2/ref/databases/#decimal-handling
                    raise exceptions.ValidationError(dict(balance='Incorrect current balance.'))

                if source_user_balance < amount:
                    raise exceptions.ValidationError(dict(amount='Insufficient funds.'))

                source_delta = -amount
                destination_delta = amount

                memo = 'Protocoin - Transaction {} ({}) sent ₱ {} to {} ({})'.format(
                    source_member.preferred_name + ' ' + source_member.last_name,
                    source_member.id,
                    amount,
                    destination_member.preferred_name + ' ' + destination_member.last_name,
                    destination_member.id,
                )

                tx = models.Transaction.objects.create(
                    user=source_user,
                    protocoin=source_delta,
                    amount=0,
                    number_of_membership_months=0,
                    account_type='Protocoin',
                    category='Other',
                    info_source='System',
                    memo=memo,
                )
                utils.log_transaction(tx)

                tx = models.Transaction.objects.create(
                    user=destination_user,
                    protocoin=destination_delta,
                    amount=0,
                    number_of_membership_months=0,
                    account_type='Protocoin',
                    category='Other',
                    info_source='System',
                    memo=memo,
                )
                utils.log_transaction(tx)

                return Response(200)
        except OperationalError:
            self.send_to_member(request)

    @action(detail=True, methods=['get'])
    def card_vend_balance(self, request, pk=None):
        auth_token = request.META.get('HTTP_AUTHORIZATION', '')
        if secrets.VEND_API_TOKEN and auth_token != 'Bearer ' + secrets.VEND_API_TOKEN:
            raise exceptions.PermissionDenied()

        source_card = get_object_or_404(models.Card, card_number=pk)
        source_user = source_card.user

        user_balance = source_user.transactions.aggregate(Sum('protocoin'))['protocoin__sum'] or 0
        user_balance = float(user_balance)

        res = dict(
            balance=user_balance,
            first_name=source_user.member.preferred_name,
        )
        return Response(res)

    @action(detail=False, methods=['get'])
    def printer_balance(self, request, pk=None):
        #auth_token = request.META.get('HTTP_AUTHORIZATION', '')
        #if secrets.VEND_API_TOKEN and auth_token != 'Bearer ' + secrets.VEND_API_TOKEN:
        #    raise exceptions.PermissionDenied()

        track = cache.get('track', {})
        track_graphics_computer = track.get('PROTOGRAPH1', None)

        if not track_graphics_computer:
            return Response(200)

        track_username = track_graphics_computer['username']
        track_time = track_graphics_computer['time']

        try:
            source_user = User.objects.get(username__iexact=track_username)
        except User.DoesNotExist:
            return Response(200)

        if time.time() - track_time > 10:
            return Response(200)

        user_balance = source_user.transactions.aggregate(Sum('protocoin'))['protocoin__sum'] or 0
        user_balance = float(user_balance)

        res = dict(
            balance=user_balance,
            first_name=source_user.member.preferred_name,
        )
        return Response(res)

    @action(detail=True, methods=['post'])
    def card_vend_request(self, request, pk=None):
        try:
            with transaction.atomic():
                auth_token = request.META.get('HTTP_AUTHORIZATION', '')
                if secrets.VEND_API_TOKEN and auth_token != 'Bearer ' + secrets.VEND_API_TOKEN:
                    raise exceptions.PermissionDenied()

                source_card = get_object_or_404(models.Card, card_number=pk)
                source_user = source_card.user

                machine = request.data.get('machine', 'unknown')

                try:
                    number = request.data['number']
                except KeyError:
                    raise exceptions.ValidationError(dict(number='This field is required.'))

                try:
                    balance = float(request.data['balance'])
                except KeyError:
                    raise exceptions.ValidationError(dict(balance='This field is required.'))
                except ValueError:
                    raise exceptions.ValidationError(dict(balance='Invalid number.'))

                try:
                    amount = float(request.data['amount'])
                except KeyError:
                    raise exceptions.ValidationError(dict(amount='This field is required.'))
                except ValueError:
                    raise exceptions.ValidationError(dict(amount='Invalid number.'))

                # also prevents negative spending
                if amount < 0.25:
                    raise exceptions.ValidationError(dict(amount='Amount too small.'))


                source_user_balance = source_user.transactions.aggregate(Sum('protocoin'))['protocoin__sum'] or 0
                source_user_balance = float(source_user_balance)

                if abs(source_user_balance - balance) > 0.01:  # stupid https://docs.djangoproject.com/en/4.2/ref/databases/#decimal-handling
                    raise exceptions.ValidationError(dict(balance='Incorrect current balance. Try refreshing the page.'))

                if source_user_balance < amount:
                    raise exceptions.ValidationError(dict(amount='Insufficient funds.'))

                source_delta = -amount

                memo = 'Protocoin - Purchase spent ₱ {} on {} vending machine item #{}'.format(
                    amount,
                    machine,
                    number,
                )

                tx = models.Transaction.objects.create(
                    user=source_user,
                    protocoin=source_delta,
                    amount=0,
                    number_of_membership_months=0,
                    account_type='Protocoin',
                    category='Snacks',
                    info_source='System',
                    memo=memo,
                )
                utils.log_transaction(tx)

                return Response(200)
        except OperationalError:
            self.card_vend_request(request, pk)

    @action(detail=False, methods=['get'])
    def transactions(self, request):
        transactions = models.Transaction.objects.exclude(protocoin=0).order_by('-date', '-id')
        total_protocoin = transactions.aggregate(Sum('protocoin'))['protocoin__sum'] or 0

        serializer = serializers.ProtocoinTransactionSerializer(transactions, many=True)

        res = dict(
            total_protocoin=total_protocoin,
            transactions=serializer.data,
        )
        return Response(res)

    @action(detail=False, methods=['post'])
    def printer_report(self, request, pk=None):
        try:
            with transaction.atomic():
                auth_token = request.META.get('HTTP_AUTHORIZATION', '')
                if secrets.PRINTER_API_TOKEN and auth_token != 'Bearer ' + secrets.PRINTER_API_TOKEN:
                    raise exceptions.PermissionDenied()

                # {'job_name': 'download.png', 'uuid': '6abbad4d-dda3-4954-b4f1-ac77933a0562', 'timestamp': '20230211173624',
                # 'job_status': '0', 'user_name': 'Tanner.Collin', 'source': '1', 'paper_name': 'Plain Paper', 'paper_sqi': '356', 'ink_ul': '54'}

                job_uuid = request.data['uuid']
                username = request.data['user_name']

                logging.info('New printer job UUID: %s, username: %s', str(job_uuid), str(username))

                if not job_uuid:
                    msg = 'Missing job UUID, aborting.'
                    utils.alert_tanner(msg)
                    logger.error(msg)
                    return Response(200)

                tx = models.Transaction.objects.filter(reference_number=job_uuid)
                if tx.exists():
                    msg = 'Job {}: already billed for in transaction {}, aborting.'.format(job_uuid, tx[0].id)
                    utils.alert_tanner(msg)
                    logger.error(msg)
                    return Response(200)

                if not username:
                    msg = 'Job {}: missing username, aborting.'.format(job_uuid)
                    utils.alert_tanner(msg)
                    logger.error(msg)
                    return Response(200)

                # status 0 = complete
                # status 3 = cancelled

                is_completed = request.data['job_status'] == '0'
                is_print = request.data['source'] == '1'

                if not is_completed:
                    msg = 'Job {} user {}: not complete, aborting.'.format(job_uuid, username)
                    utils.alert_tanner(msg)
                    logger.error(msg)
                    return Response(200)

                if not is_print:
                    msg = 'Job {} user {}: not a print, aborting.'.format(job_uuid, username)
                    utils.alert_tanner(msg)
                    logger.error(msg)
                    return Response(200)

                try:
                    user = User.objects.get(username__iexact=username)
                except User.DoesNotExist:
                    msg = 'Job {}: unable to find username {}, aborting.'.format(job_uuid, username)
                    utils.alert_tanner(msg)
                    logger.error(msg)
                    return Response(200)

                INK_PROTOCOIN_PER_ML = 0.75
                DEFAULT_PAPER_PROTOCOIN_PER_M = 0.50
                PROTOCOIN_PER_PRINT = 2.0

                total_cost = PROTOCOIN_PER_PRINT
                logging.info('    Fixed cost: %s', str(PROTOCOIN_PER_PRINT))

                microliters = float(request.data['ink_ul'])
                millilitres = microliters / 1000.0
                cost = millilitres * INK_PROTOCOIN_PER_ML
                total_cost += cost
                logging.info('    %s ul ink cost: %s', str(microliters), str(cost))

                PAPER_COSTS = {
                    'Plain Paper': 0.25,
                }

                squareinches = float(request.data['paper_sqi'])
                squaremetres = squareinches / 1550.0
                cost = squaremetres * PAPER_COSTS.get(request.data['paper_name'], DEFAULT_PAPER_PROTOCOIN_PER_M)
                total_cost += cost
                logging.info('    %s sqi paper cost: %s', str(squareinches), str(cost))

                total_cost = round(total_cost, 2)

                logging.info('Total cost: %s protocoin', str(total_cost))

                memo = 'Protocoin - Purchase spent ₱ {} printing {}'.format(
                    total_cost,
                    request.data['job_name'][:100],
                )

                tx = models.Transaction.objects.create(
                    user=user,
                    protocoin=-total_cost,
                    amount=0,
                    number_of_membership_months=0,
                    account_type='Protocoin',
                    category='Consumables',
                    info_source='System',
                    reference_number=job_uuid,
                    memo=memo,
                )
                utils.log_transaction(tx)

                track = cache.get('track', {})

                devicename = 'LASTLARGEPRINT'
                first_name = username.split('.')[0].title()

                track[devicename] = dict(
                    time=time.time(),
                    username=username,
                    first_name=first_name,
                )
                cache.set('track', track)

                return Response(200)
        except OperationalError:
            self.printer_report(request, pk)


class PinballViewSet(Base):
    @action(detail=False, methods=['post'])
    def score(self, request):
        auth_token = request.META.get('HTTP_AUTHORIZATION', '')
        if secrets.PINBALL_API_TOKEN and auth_token != 'Bearer ' + secrets.PINBALL_API_TOKEN:
            raise exceptions.PermissionDenied()

        card_number = request.data.get('card_number', None)

        if card_number:
            card = get_object_or_404(models.Card, card_number=card_number)
            user = card.user
        else:
            user = None

        try:
            game_id = int(request.data['game_id'])
        except KeyError:
            raise exceptions.ValidationError(dict(game_id='This field is required.'))
        except ValueError:
            raise exceptions.ValidationError(dict(game_id='Invalid number.'))

        try:
            player = int(request.data['player'])
        except KeyError:
            raise exceptions.ValidationError(dict(player='This field is required.'))
        except ValueError:
            raise exceptions.ValidationError(dict(player='Invalid number.'))

        try:
            score = int(request.data['score'])
        except KeyError:
            raise exceptions.ValidationError(dict(score='This field is required.'))
        except ValueError:
            raise exceptions.ValidationError(dict(score='Invalid number.'))

        if score % 10:
            raise exceptions.ValidationError(dict(score='Score must end in a 0.'))

        _ = models.PinballScore.objects.update_or_create(
            game_id=game_id,
            player=player,
            defaults=dict(
                user=user,
                score=score,
                finished_at=now(),
            ),
        )

        return Response(200)

    @action(detail=True, methods=['get'])
    def get_name(self, request, pk=None):
        auth_token = request.META.get('HTTP_AUTHORIZATION', '')
        if secrets.PINBALL_API_TOKEN and auth_token != 'Bearer ' + secrets.PINBALL_API_TOKEN:
            raise exceptions.PermissionDenied()

        card = get_object_or_404(models.Card, card_number=pk)
        member = card.user.member

        res = dict(
            name=member.preferred_name + ' ' + member.last_name[0]
        )
        return Response(res)

    @action(detail=False, methods=['get'])
    def high_scores(self, request):
        members = models.Member.objects.all()
        members = members.annotate(
            pinball_score=Max('user__scores__score', filter=Q(user__scores__id__gte=6720)),
        ).exclude(pinball_score__isnull=True).order_by('-pinball_score')

        scores = []

        for member in members:
            scores.append(dict(
                name=member.preferred_name + ' ' + member.last_name[0],
                score=member.pinball_score,
                member_id=member.id,
            ))

        return Response(scores)

    @action(detail=False, methods=['get'])
    def monthly_high_scores(self, request):
        now = utils.now_alberta_tz()
        current_month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

        members = models.Member.objects.all()
        members = members.annotate(
            pinball_score=Max('user__scores__score', filter=Q(user__scores__finished_at__gte=current_month_start)),
        ).exclude(pinball_score__isnull=True).order_by('-pinball_score')

        scores = []

        for member in members:
            scores.append(dict(
                name=member.preferred_name + ' ' + member.last_name[0],
                score=member.pinball_score,
                member_id=member.id,
            ))

        return Response(scores)


class HostingViewSet(Base):
    @action(detail=False, methods=['post'])
    def offer(self, request):
        #auth_token = request.META.get('HTTP_AUTHORIZATION', '')
        #if secrets.PINBALL_API_TOKEN and auth_token != 'Bearer ' + secrets.PINBALL_API_TOKEN:
        #    raise exceptions.PermissionDenied()

        try:
            member_id = int(request.data['member_id'])
        except KeyError:
            raise exceptions.ValidationError(dict(game_id='This field is required.'))
        except ValueError:
            raise exceptions.ValidationError(dict(game_id='Invalid number.'))

        try:
            hours = int(request.data['hours'])
        except KeyError:
            raise exceptions.ValidationError(dict(player='This field is required.'))
        except ValueError:
            raise exceptions.ValidationError(dict(player='Invalid number.'))

        hosting_member = get_object_or_404(models.Member, id=member_id)
        hosting_user = hosting_member.user

        logging.info('Hosting offer from %s %s for %s hours', hosting_member.preferred_name, hosting_member.last_name, hours)

        try:
            current_hosting = models.Hosting.objects.get(user=hosting_user, finished_at__gte=now())
            logging.info('Current hosting by member: %s', current_hosting)
            new_end = now() + datetime.timedelta(hours=hours)
            new_delta = new_end - current_hosting.started_at
            new_hours = new_delta.seconds / 3600

            logging.info(
                'Hosting %s from %s is still going, updating hours from %s to %s.',
                current_hosting.id,
                current_hosting.started_at,
                current_hosting.hours,
                new_hours
            )

            current_hosting.finished_at = new_end
            current_hosting.hours = new_hours
            current_hosting.save()

        except models.Hosting.DoesNotExist:
            h = models.Hosting.objects.create(
                user=hosting_user,
                hours=hours,
                finished_at=now() + datetime.timedelta(hours=hours),
            )

            logging.info('No current hosting for that user, new hosting #%s created.', h.id)

            try:  # TODO: remove try / except
                # send a message to Spacebar
                message = '{} just offered to host for {} hours from now until {}!'.format(
                    hosting_user.member.preferred_name,
                    hours,
                    h.finished_at.astimezone(utils.TIMEZONE_CALGARY).strftime('%-I:%M %p, %b %d'),
                )
                if hosting_user.member.discourse_username:
                    message += ' Tag @{} here to get their attention.'.format(
                        hosting_user.member.discourse_username,
                    )
                utils.spaceporter_host(message)
            except:
                pass

        # update "open until" time
        hosting = models.Hosting.objects.order_by('-finished_at').first()
        closing = dict(
            time=hosting.finished_at.timestamp(),
            time_str=hosting.finished_at.astimezone(utils.TIMEZONE_CALGARY).strftime('%-I:%M %p'),
            first_name=hosting.user.member.preferred_name,
        )
        cache.set('closing', closing)

        return Response(200)

    @action(detail=False, methods=['get'])
    def high_scores(self, request):
        members = models.Member.objects.all()
        members = members.annotate(
            hosting_hours=Sum('user__hosting__hours'),
        ).exclude(hosting_hours__isnull=True).order_by('-hosting_hours')

        hours = []

        for member in members:
            hours.append(dict(
                name=member.preferred_name + ' ' + member.last_name[0],
                hours=member.hosting_hours,
                member_id=member.id,
            ))

        return Response(hours)

    @action(detail=False, methods=['get'])
    def monthly_high_scores(self, request):
        now = utils.now_alberta_tz()
        current_month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

        members = models.Member.objects.all()
        members = members.annotate(
            hosting_hours=Sum('user__hosting__hours', filter=Q(user__hosting__finished_at__gte=current_month_start)),
        ).exclude(hosting_hours__isnull=True).order_by('-hosting_hours')

        scores = []

        for member in members:
            scores.append(dict(
                name=member.preferred_name + ' ' + member.last_name[0],
                hours=member.hosting_hours,
                member_id=member.id,
            ))

        return Response(scores)


class SignupHelperViewSet(Base):
    @action(detail=False, methods=['get'])
    def high_scores(self, request):
        members = models.Member.objects.all()
        members = members.annotate(
            signups=Count('user__signed_up', filter=Q(user__signed_up__status__in=['Current', 'Prepaid']), distinct=True),
            #signups=Count('user__signed_up', filter=Q(user__signed_up__user__transactions__isnull=False), distinct=True),
        ).exclude(signups=0).order_by('-signups')

        helpers = []

        for member in members:
            helpers.append(dict(
                name=member.preferred_name + ' ' + member.last_name[0],
                signups=member.signups,
                member_id=member.id,
            ))

        return Response(helpers)


class StorageSpaceViewSet(Base, List, Retrieve, Update):
    permission_classes = [AllowMetadata | IsAuthenticated, IsAdminOrReadOnly]
    queryset = models.StorageSpace.objects.all().select_related('user__member').order_by('id')
    serializer_class = serializers.StorageSpaceSerializer

    @action(detail=False, methods=['post'], permission_classes=[AllowMetadata | IsAuthenticated])
    def claim(self, request):
        user = self.request.user

        if user.storage.count():
            raise exceptions.ValidationError(dict(shelf_id='You already have a shelf.'))

        try:
            shelf_id = str(request.data['shelf_id']).upper()
        except KeyError:
            raise exceptions.ValidationError(dict(shelf_id='This field is required.'))

        try:
            storage = models.StorageSpace.objects.get(shelf_id=shelf_id)
        except models.StorageSpace.DoesNotExist:
            raise exceptions.ValidationError(dict(shelf_id='Shelf ID not found.'))

        if storage.location != 'member_shelves':
            raise exceptions.ValidationError(dict(shelf_id='Not a member shelf. Please see a Director.'))

        if storage.user:
            owner = storage.user.member.preferred_name
            raise exceptions.ValidationError(dict(shelf_id='Shelf already belongs to {}.'.format(owner)))

        storage.user = user
        storage.save()

        return Response(200)


class SponsorshipViewSet(Base):
    permission_classes = [AllowMetadata | IsAuthenticated]
    queryset = models.Member.objects.all()

    @action(detail=True, methods=['post'])
    def offer(self, request, pk=None):
        value = self.request.data['value']
        member = self.get_object()
        sponsor = self.request.user.member
        if value == 'true':
            sponsor.sponsorship.add(member.id)
            logging.info('Member %s is now sponsoring member %s', sponsor.preferred_name, member.preferred_name)
        else:
            sponsor.sponsorship.remove(member.id)
            logging.info('Member %s revoked sponsorship for member %s', sponsor.preferred_name, member.preferred_name)
        sponsor.save()
        return Response(200)

class RegistrationView(RegisterView):
    serializer_class = serializers.MyRegisterSerializer

class PasswordChangeView(PasswordChangeView):
    permission_classes = [AllowMetadata | IsAuthenticated]
    serializer_class = serializers.MyPasswordChangeSerializer

class PasswordResetView(PasswordResetView):
    serializer_class = serializers.MyPasswordResetSerializer

class PasswordResetConfirmView(PasswordResetConfirmView):
    serializer_class = serializers.MyPasswordResetConfirmSerializer

class SpaceportAuthView(LoginView):
    serializer_class = serializers.SpaceportAuthSerializer

class MyLoginView(LoginView):
    serializer_class = serializers.MyLoginSerializer


@api_view()
def null_view(request, *args, **kwargs):
    raise Http404
