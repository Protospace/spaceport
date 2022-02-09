import logging
logger = logging.getLogger(__name__)

import os
import smtplib
from datetime import datetime, timedelta

from django.core.mail import send_mail

from . import utils
from .. import settings

EMAIL_DIR = os.path.join(settings.BASE_DIR, 'apiserver/api/emails/')

def send_welcome_email(member):
    vetting_date = member.application_date + timedelta(days=28)

    def replace_fields(text):
        return text.replace(
            '[name]', member.first_name,
        ).replace(
            '[username]', member.user.username,
        ).replace(
            '[date]', vetting_date.strftime('%A, %B %d'),
        )

    with open(EMAIL_DIR + 'welcome.txt', 'r') as f:
        email_text = replace_fields(f.read())

    with open(EMAIL_DIR + 'welcome.html', 'r') as f:
        email_html = replace_fields(f.read())

    send_mail(
        subject='Welcome to Protospace!',
        message=email_text,
        from_email=None,  # defaults to DEFAULT_FROM_EMAIL
        recipient_list=[member.user.email],
        html_message=email_html,
    )

    logger.info('Sent welcome email:\n' + email_text)
