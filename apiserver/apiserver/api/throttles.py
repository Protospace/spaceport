import logging
logger = logging.getLogger(__name__)

from rest_framework import throttling

class LoggingThrottle(throttling.BaseThrottle):
    def allow_request(self, request, view):
        if request.user.id:
            user = '{} ({})'.format(request.user, request.user.member.id)
        else:
            user = None

        method = request._request.method
        path = request._request.path

        if method == 'OPTIONS':
            return True

        if path.startswith('/lockout/'):
            return True
        elif path == '/stats/sign/':
            pass
        elif path.startswith('/stats/'):
            return True
        elif path == '/sessions/' and user == None:
            return True

        if request.data:
            data = request.data.dict()
            for key in ['password', 'password1', 'password2', 'old_password', 'new_password1', 'new_password2']:
                if key in data:
                    data[key] = '[CENSORED]'
        else:
            data = None

        logging.info('%s %s | User: %s | Data: %s', method, path, user, data)
        return True
