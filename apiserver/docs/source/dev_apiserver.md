# API Server Development Setup

This guide assumes you are using [Debian GNU/Linux 11](https://cdimage.debian.org/cdimage/unofficial/non-free/images-including-firmware/archive/11.2.0+nonfree/amd64/iso-cd/firmware-11.2.0-amd64-netinst.iso) or [Ubuntu 20.04 LTS](https://releases.ubuntu.com/20.04/). If you
aren't, just spin up a VM with the correct version. Things break if you don't.

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

You need to make sure the Python virtual environment `(env)` is enabled whenever
you run the API server.

Copy the secrets file and optionally fill out values depending on which
[[integrations]] you wish to enable. It runs fine by default.

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

Create a super user so you can manage who's a director or staff. This is a special
account and is not treated as a member.

```
(env) $ python manage.py createsuperuser --email admin@example.com --username admin
```

## Running

Run the development server:

```
$ source env/bin/activate
(env) $ DEBUG=true BINDALL=true python manage.py runserver 0.0.0.0:8000
```

The development server is now listening on port 8000. You can connect to it by
opening `http://<ip address>:8000/` in your web browser. If it's running
locally, that would be [http://127.0.0.1:8000/](http://127.0.0.1:8000/).
