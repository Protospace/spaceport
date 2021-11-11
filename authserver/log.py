import logging
import logging.config

class IgnorePing(logging.Filter):
    def filter(self, record):
        return 'GET /ping' not in record.getMessage()

LOG_DICT = {
    'version': 1,
    'formatters': {
        'default': {
            'format': '[%(asctime)s] [%(process)d] [%(levelname)7s] %(message)s',
        },
    },
    'filters': {
        'ignore_ping': {
            '()': 'log.IgnorePing',
        },
    },
    'handlers': {
        'wsgi': {
            'class': 'logging.StreamHandler',
            'filters': ['ignore_ping'],
            'stream': 'ext://flask.logging.wsgi_errors_stream',
            'formatter': 'default'
        },
        'console': {
            'level': 'DEBUG',
            'filters': ['ignore_ping'],
            'class': 'logging.StreamHandler',
            'formatter': 'default'
        },
        'null': {
            'level': 'DEBUG',
            'filters': ['ignore_ping'],
            'class': 'logging.NullHandler',
            'formatter': 'default'
        },
    },
    'loggers': {
        'gunicorn': {
            'handlers': ['console'],
            'level': 'DEBUG',
            'propagate': False,
        },
    },
    'root': {
        'level': 'DEBUG',
        'handlers': ['wsgi']
    }
}

logging.config.dictConfig(LOG_DICT)
logger = logging.getLogger(__name__)

logger.info('Logging enabled.')

from logging_tree import printout
printout()

