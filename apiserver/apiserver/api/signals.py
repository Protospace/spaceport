import logging
logger = logging.getLogger(__name__)

from django.dispatch import receiver
from simple_history.signals import (
    pre_create_historical_record,
    post_create_historical_record
)

from . import models
from .permissions import is_admin_director

def get_object_owner(obj):
    full_name = lambda member: member.preferred_name + ' ' + member.last_name

    if obj.__class__.__name__ == 'Member':
        return full_name(obj), obj.id

    if getattr(obj, 'user', False):
        return full_name(obj.user.member), obj.user.member.id

    if getattr(obj, 'instructor', False):
        return full_name(obj.instructor.member), obj.instructor.member.id

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

    try:
        history_type = history_instance.get_history_type_display()
        object_name = instance.__class__.__name__

        if object_name in ['User', 'IPN']: return

        if history_type == 'Changed':
            changes = history_instance.diff_against(history_instance.prev_record).changes
        else:
            changes = []

        # it's possible for changes to be empty if model saved with no diff
        if len(changes) or history_type in ['Created', 'Deleted']:
            owner = get_object_owner(instance)

            index = models.HistoryIndex.objects.create(
                history=history_instance,
                owner_id=owner[1],
                owner_name=owner[0],
                object_name=object_name,
                history_user=history_user,
                history_date=history_instance.history_date,
                history_type=history_type,
                revert_url=history_instance.revert_url(),
                is_system=bool(history_user == None),
                is_admin=is_admin_director(history_user),
            )

            for num, change in enumerate(changes):
                change_old = str(change.old)
                change_new = str(change.new)

                if len(change_old) > 200:
                    change_old = change_old[:200] + '... [truncated]'
                if len(change_new) > 200:
                    change_new = change_new[:200] + '... [truncated]'

                models.HistoryChange.objects.create(
                    index=index,
                    field=change.field,
                    old=change_old,
                    new=change_new,
                )

                logger.info('History - {} changed {}\'s {} {}/{}: {} "{}" --> "{}"'.format(
                    history_user or 'System',
                    owner[0],
                    object_name,
                    num+1,
                    len(changes),
                    change.field,
                    change_old,
                    change_new,
                ))

    except BaseException as e:
        logger.error('History Signal - {} - {}'.format(e.__class__.__name__, e))
        logger.info(str(sender))
        logger.info(str(instance))
        logger.info(str(history_instance))
        logger.info(str(history_change_reason))
        logger.info(str(history_user))
