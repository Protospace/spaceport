import logging
logger = logging.getLogger(__name__)

import os
import smtplib
import time
from datetime import datetime, timedelta

from django.core.mail import send_mail, EmailMultiAlternatives

from . import utils
from .. import settings

EMAIL_DIR = os.path.join(settings.BASE_DIR, 'apiserver/api/emails/')

def send_welcome_email(member):
    vetting_date = member.application_date + timedelta(days=28)

    def replace_fields(text):
        return text.replace(
            '[name]', member.preferred_name,
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

def send_ical_email(member, session, ical_file):
    def replace_fields(text):
        date = session.datetime.astimezone(utils.TIMEZONE_CALGARY).strftime('%A, %B %d')

        return text.replace(
            '[name]', member.preferred_name,
        ).replace(
            '[class]', session.course.name,
        ).replace(
            '[date]', date
        )

    with open(EMAIL_DIR + 'ical.txt', 'r') as f:
        email_text = replace_fields(f.read())

    with open(EMAIL_DIR + 'ical.html', 'r') as f:
        email_html = replace_fields(f.read())

    subject = 'Protospace ' + session.course.name
    from_email = None  # defaults to DEFAULT_FROM_EMAIL
    to = member.user.email
    msg = EmailMultiAlternatives(subject, email_text, from_email, [to])
    msg.attach_alternative(email_html, "text/html")
    msg.attach('event.ics', ical_file, 'text/calendar')
    msg.send()

    logger.info('Sent ical email:\n' + email_text)

def send_interest_email(interest):
    def replace_fields(text):
        return text.replace(
            '[name]', interest.user.member.preferred_name,
        ).replace(
            '[course]', interest.course.name,
        ).replace(
            '[link]', 'https://my.protospace.ca/courses/' + str(interest.course.id),
        )

    with open(EMAIL_DIR + 'interest.txt', 'r') as f:
        email_text = replace_fields(f.read())

    with open(EMAIL_DIR + 'interest.html', 'r') as f:
        email_html = replace_fields(f.read())

    send_mail(
        subject='Protospace class scheduled',
        message=email_text,
        from_email=None,  # defaults to DEFAULT_FROM_EMAIL
        recipient_list=[interest.user.email],
        html_message=email_html,
    )

    if not settings.EMAIL_HOST:
        time.sleep(0.5)  # simulate slowly sending emails when logging to console

    logger.info('Sent interest email:\n' + email_text)

def send_usage_bill_email(user, device, month, minutes, overage, bill):
    def replace_fields(text):
        return text.replace(
            '[name]', user.member.preferred_name,
        ).replace(
            '[device]', device,
        ).replace(
            '[month]', month,
        ).replace(
            '[minutes]', str(minutes),
        ).replace(
            '[overage]', str(overage),
        ).replace(
            '[bill]', bill,
        )

    with open(EMAIL_DIR + 'usage_bill.txt', 'r') as f:
        email_text = replace_fields(f.read())

    send_mail(
        subject='{} {} Usage Bill'.format(month, device),
        message=email_text,
        from_email=None,  # defaults to DEFAULT_FROM_EMAIL
        recipient_list=[user.email, 'directors@protospace.ca', 'spaceport@tannercollin.com'],
    )

    if not settings.EMAIL_HOST:
        time.sleep(0.5)  # simulate slowly sending emails when logging to console

    logger.info('Sent usage bill email:\n' + email_text)

def send_overdue_email(member):
    def replace_fields(text):
        return text.replace(
            '[name]', member.preferred_name,
        ).replace(
            '[date]', member.expire_date.strftime('%B %d, %Y'),
        )

    with open(EMAIL_DIR + 'overdue.txt', 'r') as f:
        email_text = replace_fields(f.read())

    with open(EMAIL_DIR + 'overdue.html', 'r') as f:
        email_html = replace_fields(f.read())

    send_mail(
        subject='Protospace member dues overdue',
        message=email_text,
        from_email=None,  # defaults to DEFAULT_FROM_EMAIL
        recipient_list=[member.user.email, 'directors@protospace.ca', 'spaceport@tannercollin.com'],
        html_message=email_html,
    )

    logger.info('Sent overdue email:\n' + email_text)
