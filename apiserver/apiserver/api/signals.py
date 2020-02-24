from django.dispatch import receiver
from simple_history.signals import (
    pre_create_historical_record,
    post_create_historical_record
)

from . import models
from .permissions import is_admin_director

def get_object_owner(obj):
    full_name = lambda member: member.first_name + ' ' + member.last_name

    if getattr(obj, 'user', False):
        return full_name(obj.user.member), obj.user.member.id

    if getattr(obj, 'instructor', False):
        return full_name(obj.instructor.member), obj.instructor.member.id

    if getattr(obj, 'member_id', False):
        try:
            member = models.Member.objects.get(id=obj.member_id)
            return full_name(member), member.id
        except models.Member.DoesNotExist:
            pass

    return 'Protospace', 0

@receiver(post_create_historical_record, dispatch_uid='create_hist')
def post_create_historical_record_callback(
        sender,
        instance,
        history_instance,
        history_change_reason,
        history_user,
        using,
        **kwargs):

    changes = history_instance.diff_against(history_instance.prev_record).changes

    if changes:
        owner = get_object_owner(instance)

        index = models.HistoryIndex.objects.create(
            content_object=history_instance,
            owner_name=owner[0],
            owner_id=owner[1],
            history_user=history_user,
            history_date=history_instance.history_date,
            history_type=history_instance.get_history_type_display(),
            revert_url=history_instance.revert_url(),
            is_system=bool(history_user == None),
            is_admin=is_admin_director(history_user),
        )

        for change in changes:
            models.HistoryChange.objects.create(
                index=index,
                field=change.field,
                old=change.old,
                new=change.new,
            )
