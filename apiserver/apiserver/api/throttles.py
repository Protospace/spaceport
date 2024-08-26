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
            pass  # log this one
        elif path.startswith('/stats/'):
            return True
        elif path == '/sessions/' and user == None:
            return True
        elif path in [
            '/pinball/high_scores/',
            '/pinball/monthly_high_scores/',
            '/protocoin/printer_balance/',
            '/hosting/high_scores/',
            '/hosting/monthly_high_scores/',
            '/signuphelper/high_scores/',
            '/signuphelper/monthly_high_scores/',
            '/stats/ord2/printer3d/',
            '/stats/ord3/printer3d/',
            '/stats/p1s1/printer3d/',
            '/stats/solar_data/',
        ]:
            return True

        if path == '/user/6005/':
            return False

        if request.data:
            if type(request.data) is not dict:
                data = request.data.dict()
            else:
                data = request.data
            for key in ['password', 'password1', 'password2', 'old_password', 'new_password1', 'new_password2']:
                if key in data:
                    data[key] = '[CENSORED]'
        else:
            data = None

        logging.info('%s %s | User: %s | Data: %s', method, path, user, data)
        return True
