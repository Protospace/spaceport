from django.apps import AppConfig


class ApiConfig(AppConfig):
    name = 'apiserver.api'

    def ready(self):
        from . import signals
