from django.conf.urls import url
from django.contrib import admin
from django.urls import include, path
from rest_framework import routers

from .api import views

router = routers.DefaultRouter()
#router.register(r'users', views.UserViewSet)
router.register(r'members', views.MemberViewSet, basename='members')
router.register(r'courses', views.CourseViewSet, basename='course')
router.register(r'sessions', views.SessionViewSet, basename='session')
router.register(r'search', views.SearchViewSet, basename='search')
router.register(r'cards', views.CardViewSet, basename='card')
#router.register(r'me', views.FullMemberView, basename='fullmember')
#router.register(r'registration', views.RegistrationViewSet, basename='register')

urlpatterns = [
    path('', include(router.urls)),
    path('admin/', admin.site.urls),
    path('api-auth/', include('rest_framework.urls')),
    url(r'^rest-auth/', include('rest_auth.urls')),
    url(r'^registration/', views.RegistrationView.as_view(), name='rest_name_register'),
    url(r'^password/change/', views.PasswordChangeView.as_view(), name='rest_password_change'),
    url(r'^user/', views.UserView.as_view(), name='user'),
]
