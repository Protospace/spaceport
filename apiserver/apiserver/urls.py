from django.conf.urls import url
from django.contrib import admin
from django.urls import include, path
from rest_framework import routers
from rest_auth.views import LoginView, LogoutView

from .api import views
from . import secrets, settings

router = routers.DefaultRouter()
router.register(r'door', views.DoorViewSet, basename='door')
router.register(r'lockout', views.LockoutViewSet, basename='lockout')
router.register(r'cards', views.CardViewSet, basename='card')
router.register(r'stats', views.StatsViewSet, basename='stats')
router.register(r'search', views.SearchViewSet, basename='search')
router.register(r'members', views.MemberViewSet, basename='members')
router.register(r'courses', views.CourseViewSet, basename='course')
router.register(r'history', views.HistoryViewSet, basename='history')
router.register(r'vetting', views.VettingViewSet, basename='vetting')
router.register(r'sessions', views.SessionViewSet, basename='session')
router.register(r'training', views.TrainingViewSet, basename='training')
router.register(r'transactions', views.TransactionViewSet, basename='transaction')
router.register(r'charts/membercount', views.MemberCountViewSet, basename='membercount')
router.register(r'charts/signupcount', views.SignupCountViewSet, basename='signupcount')
router.register(r'charts/spaceactivity', views.SpaceActivityViewSet, basename='spaceactivity')
#router.register(r'me', views.FullMemberView, basename='fullmember')
#router.register(r'registration', views.RegistrationViewSet, basename='register')

urlpatterns = [
    path('', include(router.urls)),
    url(r'^rest-auth/login/$', LoginView.as_view(), name='rest_login'),
    url(r'^spaceport-auth/login/$', views.SpaceportAuthView.as_view(), name='spaceport_auth'),
    url(r'^rest-auth/logout/$', LogoutView.as_view(), name='rest_logout'),
    url(r'^password/reset/$', views.PasswordResetView.as_view(), name='rest_password_reset'),
    url(r'^password/reset/confirm/$', views.PasswordResetConfirmView.as_view(), name='password_reset_confirm'),
    url(r'^password/reset/confirm/(?P<uidb64>[0-9A-Za-z_\-]+)/(?P<token>[0-9A-Za-z]{1,13}-[0-9A-Za-z]{1,32})/$', views.null_view, name='password_reset_confirm'),
    url(r'^password/change/', views.PasswordChangeView.as_view(), name='rest_password_change'),
    url(r'^registration/', views.RegistrationView.as_view(), name='rest_name_register'),
    url(r'^user/', views.UserView.as_view(), name='user'),
    url(r'^ping/', views.PingView.as_view(), name='ping'),
    url(r'^paste/', views.PasteView.as_view(), name='paste'),
    url(r'^backup/', views.BackupView.as_view(), name='backup'),
]

if secrets.IPN_RANDOM:
    IPN_ROUTE = r'^ipn/{}/'.format(secrets.IPN_RANDOM)
    urlpatterns.append(url(IPN_ROUTE, views.IpnView.as_view(), name='ipn'))

if secrets.ADMIN_RANDOM:
    ADMIN_ROUTE = '{}/admin/'.format(secrets.ADMIN_RANDOM)
    urlpatterns.append(path(ADMIN_ROUTE, admin.site.urls))

if settings.DEBUG:
    urlpatterns += [
        path('api-auth/', include('rest_framework.urls')),
    ]
