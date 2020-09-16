from log import logger
import time
import secrets
import subprocess

from flask import abort

HTTP_NOTFOUND = 404

def set_wiki_password(username, password):
    # sets a user's wiki password
    # creates the account if it doesn't exist

    if not username:
        logger.error('Empty username, aborting')
        abort(400)

    logger.info('Setting wiki password for: ' + username)

    if not password:
        logger.error('Empty password, aborting')
        abort(400)

    script = secrets.WIKI_MAINTENANCE + '/createAndPromote.php'

    result = subprocess.run(['php', script, '--force', username, password],
            shell=False, text=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)

    output = result.stdout or result.stderr

    logger.info('Output: ' + output)

    if result.stderr:
        abort(400)

if __name__ == '__main__':
    set_wiki_password('tanner.collin', 'protospace1')
    pass
