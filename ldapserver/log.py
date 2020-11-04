import logging
import logging.config

LOG_DICT = {
    'version': 1,
    'formatters': {
        'default': {
            'format': '[%(asctime)s] [%(process)d] [%(levelname)7s] %(message)s',
        },
    },
    'handlers': {
        'wsgi': {
            'class': 'logging.StreamHandler',
            'stream': 'ext://flask.logging.wsgi_errors_stream',
            'formatter': 'default'
        },
        'console': {
            'level': 'DEBUG',
            'class': 'logging.StreamHandler',
            'formatter': 'default'
        },
        'null': {
            'level': 'DEBUG',
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
        'level': 'INFO',
        'handlers': ['wsgi']
    }
}

logging.config.dictConfig(LOG_DICT)
logger = logging.getLogger(__name__)

logger.info('Logging enabled.')

from logging_tree import printout
printout()
