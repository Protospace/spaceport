from log import logger

from flask import Flask, abort, request
app = Flask(__name__)

import auth_functions
import secrets

HTTP_UNAUTHORIZED = 401

def check_auth():
    auth_header = request.headers.get('Authorization', '')
    if auth_header != 'Token ' + secrets.AUTH_TOKEN:
        logger.info('Bad auth token, aborting.')
        abort(HTTP_UNAUTHORIZED)

@app.route('/')
def index():
    logger.info('Index page requested')

    return '<i>LIFE IS BUT A DREAM...</i>'

@app.route('/ping')
def ping():
    return 'pong'

@app.route('/set-wiki-password', methods=['POST'])
def set_wiki_password():
    check_auth()

    username = request.form['username']
    password = request.form['password']

    auth_functions.set_wiki_password(username, password)
    return ''

@app.route('/set-discourse-password', methods=['POST'])
def set_discourse_password():
    check_auth()

    username = request.form['username']
    password = request.form['password']
    first_name = request.form['first_name']
    email = request.form['email']

    auth_functions.set_discourse_password(username, password, first_name, email)
    return ''

@app.route('/add-discourse-group-members', methods=['POST'])
def add_discourse_group_members():
    check_auth()

    data = request.get_json()
    group_name = data['group_name']
    usernames = data['usernames']

    auth_functions.add_discourse_group_members(group_name, usernames)
    return ''

@app.route('/remove-discourse-group-members', methods=['POST'])
def remove_discourse_group_members():
    check_auth()

    data = request.get_json()
    group_name = data['group_name']
    usernames = data['usernames']

    auth_functions.remove_discourse_group_members(group_name, usernames)
    return ''

@app.route('/change-discourse-username', methods=['POST'])
def change_discourse_username():
    check_auth()

    username = request.form['username']
    new_username = request.form['new_username']

    auth_functions.change_discourse_username(username, new_username)
    return ''

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0')
