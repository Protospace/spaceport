from log import logger
import time
import secrets

from flask import abort

HTTP_NOTFOUND = 404

def set_password(username, password):
    # TODO
    print(username, password)

if __name__ == '__main__':
    print(set_password('test.test', 'password'))
    pass
