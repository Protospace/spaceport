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
    return '<i>SEE YOU SPACE SAMURAI...</i>'

@app.route('/find-user', methods=['POST'])
def check_username_exists():
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

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0')
