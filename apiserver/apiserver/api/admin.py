from django.apps import apps
from django.contrib import admin
from django.contrib.admin.sites import AlreadyRegistered
from simple_history.admin import SimpleHistoryAdmin

app_models = apps.get_app_config('api').get_models()
for model in app_models:
    if model._meta.model_name.startswith('historical'):
        continue

    try:
        admin.site.register(model, SimpleHistoryAdmin)
    except AlreadyRegistered:
        pass
