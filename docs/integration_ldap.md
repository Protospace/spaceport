# LDAP Integration

## Setup

This guide assumes you are using [Debian GNU/Linux 11](https://cdimage.debian.org/cdimage/unofficial/non-free/images-including-firmware/archive/11.2.0+nonfree/amd64/iso-cd/firmware-11.2.0-amd64-netinst.iso) or [Ubuntu 20.04 LTS](https://releases.ubuntu.com/20.04/). If you
aren't, just spin up a VM with the correct version. Support is unavailable for other operating systems.

### Install dependencies:

```
$ sudo apt update
$ sudo apt install build-essential python3 python3-dev python3-pip python-virtualenv python3-virtualenv supervisor libsasl2-dev libldap2-dev libssl-dev
```

Clone the repo. Skip this step if you already have it:

```
$ git clone https://github.com/Protospace/spaceport.git
$ cd spaceport
```

Create a venv, activate it, and install:

```
$ cd ldapserver
$ virtualenv -p python3 env
$ source env/bin/activate
(env) $ pip install -r requirements.txt
```

Edit `ldapserver/secrets.py.example` and save it as `ldapserver/secrets.py`.

Securely move the auth token to `apiserver/secrets.py` on the server running Spaceport.

Now you can run the script to test:

```
(env) $ python main.py
```

Flask will now be running on port 5000, connect to localhost:5000 to test it.

### Process Management

The script is kept alive with [supervisor](https://pypi.org/project/supervisor/).

Configure `/etc/supervisor/conf.d/ldapserver.conf`:

```
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
```

The script logs to `/var/log/ldapserver.log`.
