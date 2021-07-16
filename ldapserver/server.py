from log import logger

from flask import Flask, abort, request
app = Flask(__name__)

import ldap_functions
import secrets

HTTP_UNAUTHORIZED = 401

def check_auth():
    auth_header = request.headers.get('Authorization', '')
    if auth_header != 'Token ' + secrets.AUTH_TOKEN:
        abort(HTTP_UNAUTHORIZED)

@app.route('/')
def index():
    logger.info('Index page requested')

    return '<i>SEE YOU SPACE SAMURAI...</i>'

@app.route('/ping')
def ping():
    ldap_functions.find_user('tanner.collin')
    return 'pong'

@app.route('/find-user', methods=['POST'])
def find_user():
    check_auth()

    username = request.form['username']

    return ldap_functions.find_user(username)

@app.route('/create-user', methods=['POST'])
def create_user():
    check_auth()

    first = request.form['first']
    last = request.form['last']
    username = request.form['username']
    email = request.form['email']
    password = request.form['password']

    ldap_functions.create_user(first, last, username, email, password)
    return ''

@app.route('/set-password', methods=['POST'])
def set_password():
    check_auth()

    username = request.form['username']
    password = request.form['password']

    ldap_functions.set_password(username, password)
    return ''

@app.route('/add-to-group', methods=['POST'])
def add_to_group():
    check_auth()

    groupname = request.form['group']
    username = request.form.get('username', None) or request.form.get('email', None)

    ldap_functions.add_to_group(groupname, username)
    return ''

@app.route('/remove-from-group', methods=['POST'])
def remove_from_group():
    check_auth()

    groupname = request.form['group']
    username = request.form.get('username', None) or request.form.get('email', None)

    ldap_functions.remove_from_group(groupname, username)
    return ''

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0')
