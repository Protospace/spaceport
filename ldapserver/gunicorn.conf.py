# Gunicorn config file
#
# By default, a file named gunicorn.conf.py will be read from the same directory where gunicorn is being run.
# Reference: https://docs.gunicorn.org/en/latest/settings.html

import log

logconfig_dict = log.LOG_DICT
workers = 1
bind = ['0.0.0.0:5000']
