# API Server Development Setup

This guide assumes you are using Debian GNU/Linux 10 or Ubuntu 20.04 LTS. If you
aren't, just spin up a VPN with the correct version. Things break if you don't.

## Install Dependencies

```
$ sudo apt update
$ sudo apt install build-essential python3 python3-dev libffi-dev python3-pip python3-virtualenv memcached git
```

Clone the repo. Skip this step if you already have it:

```
$ git clone https://github.com/Protospace/spaceport.git
```

Set up Python:

```
$ cd spaceport/apiserver/
$ python3 -m virtualenv -p python3 env
$ source env/bin/activate
(env) $ pip install -r requirements.txt
```

Copy the secrets file and optionally fill out values depending on which
[[integrations]] you wish to enable.

```
(env) $ cp apiserver/secrets.py.example apiserver/secrets.py
(env) $ sensible-editor apiserver/secrets.py  # optional
```

## Initialize Database

Set up the database:

```
(env) $ python manage.py makemigrations
(env) $ python manage.py makemigrations api
(env) $ python manage.py migrate
```

Create a super user so you can manage who's director or staff:

```
(env) $ python manage.py createsuperuser --email admin@example.com --username admin
```

## Running

Run the development server:

```
$ source env/bin/activate
(env) $ DEBUG=true python manage.py runserver
```

