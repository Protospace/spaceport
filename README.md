# Spaceport

Spaceport is Calgary Protospace's member portal. It tracks membership, courses, training, access cards, and more.

Demo: https://spaceport.dns.t0.vc

## Development Setup

Install dependencies:

```text
# Python:
$ sudo apt update
$ sudo apt install python3 python3-pip python-virtualenv python3-virtualenv

# Yarn / nodejs:
# from https://yarnpkg.com/lang/en/docs/install/#debian-stable
$ curl -sS https://dl.yarnpkg.com/debian/pubkey.gpg | sudo apt-key add -
$ echo "deb https://dl.yarnpkg.com/debian/ stable main" | sudo tee /etc/apt/sources.list.d/yarn.list
$ sudo apt update
$ sudo apt install yarn
```

Clone this repo:

```text
$ git clone https://github.com/Protospace/spaceport.git
$ cd spaceport
```

### API Server

Create a venv, activate it, and install:

```text
$ cd apiserver
$ virtualenv -p python3 env
$ source env/bin/activate
(env) $ pip install -r requirements.txt
```

Now setup Django and run it:

```text
(env) $ python manage.py migrate --run-syncdb
(env) $ python manage.py createsuperuser --email admin@example.com --username admin
(env) $ DEBUG=true python manage.py runserver 0.0.0.0:8002
```

Django will now be running on port 8002, connect to localhost:8002 to test it.

#### Import Old Portal Data

Place `old_portal.sqlite3` in the same directory as `manage.py`.

```text
(env) $ bash gen_old_models.sh
(env) $ time python import_old_portal.py
```

Give it about 5 minutes to run. This will import old models into the new portal database, ready to be linked to user's emails when they sign up.

### Webclient

```text
# In a different terminal
$ cd webclient
$ yarn install
$ yarn start
```

The webclient will now be running on port 3000. Make changes and refresh to see them.

### Reverse Proxy

It's easiest to point a domain to the server and reverse proxy requests according to subdomain. If you don't set up a reverse proxy, you'll need to change URL settings.

Domains: `example.com`, `api.example.com`, `static.example.com` should all be reverse proxied.

Configure nginx:

```text
server {
    listen 80;
    root /var/www/html;
    index index.html index.htm;

    server_name example.com;

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

    server_name api.example.com;

    client_max_body_size 20M;

    location / {
        add_header 'Access-Control-Allow-Origin' '*' always;
        add_header 'Access-Control-Allow-Headers' 'content-type, authorization' always;
        add_header 'Access-Control-Allow-Methods' 'HEAD,GET,POST,PUT,PATCH,DELETE' always;
        add_header 'Access-Control-Max-Age' '600' always;
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

    server_name static.example.com;

    location / {
        try_files $uri $uri/ =404;
    }
}
```


## License

This program is free and open-source software licensed under the MIT License. Please see the `LICENSE` file for details.

That means you have the right to study, change, and distribute the software and source code to anyone and for any purpose. You deserve these rights.

## Acknowledgements

Thanks to the Protospace Portal Committee.

Thanks to all the devs behind Python, Django, DRF, Node, React, Quill, and Bleach.
