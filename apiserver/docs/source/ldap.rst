LDAP Server Setup
=================

.. contents:: :depth: 3

This guide assumes you are on a Debian-based distro.

Install dependencies:

.. sourcecode:: bash

    $ sudo apt update
    $ sudo apt install build-essential python3 python3-dev python3-pip python-virtualenv python3-virtualenv supervisor

Clone the repo:

.. sourcecode:: bash

    $ git clone https://github.com/Protospace/spaceport.git
    $ cd spaceport

Main Script
-----------

Create a venv, activate it, and install:

.. sourcecode:: bash

    $ cd ldapserver
    $ virtualenv -p python3 env
    $ source env/bin/activate
    (env) $ pip install -r requirements.txt

Edit ``ldapserver/secrets.py.example`` and save it as ``ldapserver/secrets.py``.

Securely move the auth token to ``apiserver/secrets.py`` on the server running Spaceport.

Now you can run the script to test:

.. sourcecode:: bash

    (env) $ python main.py

Flask will now be running on port 5000, connect to localhost:5000 to test it.

Process Management
------------------

The script is kept alive with `supervisor <https://pypi.org/project/supervisor/>`_.

Configure ``/etc/supervisor/conf.d/ldapserver.conf``:

.. sourcecode:: text

    [program:ldapserver]
    user=ldapserver
    directory=/opt/spaceport/ldapserver
    command=/opt/spaceport/ldapserver/env/bin/gunicorn -w 2 --bind 0.0.0.0:5000 server:app
    stopasgroup=true
    stopsignal=INT
    autostart=true
    autorestart=true
    stderr_logfile=/var/log/ldapserver.log
    stderr_logfile_maxbytes=10MB
    stdout_logfile=/var/log/ldapserver.log
    stdout_logfile_maxbytes=10MB

Script logs to ``/var/log/ldapserver.log``.
