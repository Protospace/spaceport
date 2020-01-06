from django.contrib import admin
from django.urls import include, path
from rest_framework import routers

from .api import views

router = routers.DefaultRouter()
router.register(r'users', views.UserViewSet)

urlpatterns = [
    path('', include(router.urls)),
    path('admin/', admin.site.urls),
]
