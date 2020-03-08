import logging

class IgnoreStats(logging.Filter):
    def filter(self, record):
        if 'GET /stats/' in record.msg:
            return False
        elif 'POST /stats/' in record.msg:
            return False
        else:
            return True
