Development Setup
=================

.. contents:: :depth: 3

This guide assumes you are on a Debian-based distro.

Install dependencies:

.. sourcecode:: bash

    # Python:
    $ sudo apt update
    $ sudo apt install python3 python3-pip python-virtualenv python3-virtualenv

    # Yarn / nodejs:
    # from https://yarnpkg.com/lang/en/docs/install/#debian-stable
    $ curl -sS https://dl.yarnpkg.com/debian/pubkey.gpg | sudo apt-key add -
    $ echo "deb https://dl.yarnpkg.com/debian/ stable main" | sudo tee /etc/apt/sources.list.d/yarn.list
    $ sudo apt update
    $ sudo apt install yarn

Clone the repo:

.. sourcecode:: bash

    $ git clone https://github.com/Protospace/spaceport.git
    $ cd spaceport

API Server
----------

Create a venv, activate it, and install:

.. sourcecode:: bash

    $ cd apiserver
    $ virtualenv -p python3 env
    $ source env/bin/activate
    (env) $ pip install -r requirements.txt

Edit ``apiserver/secrets.py.example`` and save it as ``apiserver/secrets.py``.

Now setup Django and run it:

.. sourcecode:: bash

    (env) $ python manage.py migrate --run-syncdb
    (env) $ python manage.py createsuperuser --email admin@example.com --username admin
    (env) $ DEBUG=true python manage.py runserver 0.0.0.0:8002

Django will now be running on port 8002, connect to localhost:8002 to test it.

Import Old Portal Data
++++++++++++++++++++++

Place ``old_portal.sqlite3`` in the same directory as ``manage.py``.

Place old member photo folders in ``old_photos/``, for example: ``old_photos/1685/photo.jpg``.

.. sourcecode:: bash

    (env) $ bash gen_old_models.sh
    (env) $ time python import_old_portal.py YYYY-MM-DD

Pass the date of the portal scrape in as an argument to the script.

Give it about 15 minutes to run. This will import old models into the new portal
database, ready to be linked to user's emails when they sign up.

Testing
+++++++

There are unit tests in `apiserver/api/tests.py` that you can run with:

.. sourcecode:: bash

    (env) $ python manage.py test

Documentation
+++++++++++++

Compile this documentation:

.. sourcecode:: bash

    (env) $ cd docs
    (env) $ make html

HTML files will be put in the `apiserver/docs/build/html` directory.

Webclient
---------

.. sourcecode:: bash

    # In a different terminal
    $ cd webclient
    $ yarn install
    $ yarn start

The webclient will now be running on port 3000. Make changes and refresh to see them.

Reverse Proxy
-------------

Point a domain to the server and reverse proxy requests according to subdomain.

Domains: `portal.example.com`, `api.portal.example.com`, `static.portal.example.com`, `docs.portal.example.com` should all be reverse proxied.

Configure nginx:

.. sourcecode:: text

    server {
        listen 80;
        root /var/www/html;
        index index.html index.htm;

        server_name portal.example.com;

        location / {
            proxy_pass http://127.0.0.1:3000/;
            proxy_set_header Host $http_host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }
    }

    server {
        listen 80;
        root /var/www/html;
        index index.html index.htm;

        server_name api.portal.example.com;

        client_max_body_size 20M;

        location / {
            add_header 'Access-Control-Allow-Origin' '*' always;
            add_header 'Access-Control-Allow-Headers' 'content-type, authorization' always;
            add_header 'Access-Control-Allow-Methods' 'HEAD,GET,POST,PUT,PATCH,DELETE' always;
            add_header 'Access-Control-Max-Age' '86400' always;
            proxy_pass http://127.0.0.1:8002/;
            proxy_set_header Host $http_host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }
    }

    server {
        listen 80;
        root /home/you/spaceport/apiserver/data/static;
        index index.html;

        server_name static.portal.example.com;

        location / {
            add_header 'cache-control' 'max-age=2678400' always;
            try_files $uri $uri/ =404;
        }
    }

    server {
        listen 80;
        root /home/you/spaceport/apiserver/docs/build/html;
        index index.html;

        server_name docs.portal.example.com;

        location / {
            try_files $uri $uri/ =404;
        }
    }

HTTPS
+++++

Install certbot and run it:

.. sourcecode:: bash

    $ sudo apt install certbot python-certbot-nginx
    $ sudo certbot --nginx

Answer the prompts, enable redirect.
