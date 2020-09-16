from flask import Flask, abort, request
app = Flask(__name__)

import auth_functions
import secrets

HTTP_UNAUTHORIZED = 401

def check_auth():
    auth_header = request.headers.get('Authorization', '')
    if auth_header != 'Token ' + secrets.AUTH_TOKEN:
        abort(HTTP_UNAUTHORIZED)

@app.route('/')
def index():
    return '<i>SEE YOU SPACE SAMURAI...</i>'

@app.route('/set-password', methods=['POST'])
def set_password():
    check_auth()

    username = request.form['username']
    password = request.form['password']

    auth_functions.set_password(username, password)
    return ''

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0')
