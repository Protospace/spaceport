from django.apps import apps
from django.contrib import admin
from django.contrib.admin.sites import AlreadyRegistered
from simple_history.admin import SimpleHistoryAdmin

app_models = apps.get_app_config('api').get_models()
for model in app_models:
    if model._meta.model_name.startswith('historical'):
        continue

    class MyAdmin(SimpleHistoryAdmin):
        pass

    try:
        if hasattr(model, 'MY_FIELDS'):
            MyAdmin.list_display = model.MY_FIELDS
            MyAdmin.search_fields = model.MY_FIELDS

        admin.site.register(model, MyAdmin)
    except AlreadyRegistered:
        pass
