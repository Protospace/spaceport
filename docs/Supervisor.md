# Supervisor

The author usually uses [supervisor](https://pypi.org/project/supervisor/) to keep processes and Python scripts running on servers.

## Theory

Some common supervisor commands:

```
$ sudo supervisorctl status
$ sudo supervisorctl restart spaceport
$ sudo supervisorctl start spaceport
$ sudo supervisorctl stop spaceport
```

## Setup

On Debian, install supervisor like so:

```
$ sudo apt install supervisor
```

The configs live in the `/etc/supervisor/conf.d/` directory and `/etc/supervisor/supervisord.conf` file.

```
$ ls -la /etc/supervisor/conf.d/
$ cat /etc/supervisor/conf.d/spaceport.conf
```

A typical config file looks like:

```
[program:spaceport]
user=spaceport
directory=/opt/spaceport/apiserver
command=/opt/spaceport/apiserver/env/bin/gunicorn -w 4 apiserver.wsgi
stopasgroup=true
autostart=true
autorestart=true
stderr_logfile=/var/log/spaceport/spaceport.log
stderr_logfile_maxbytes=100MB
stdout_logfile=/var/log/spaceport/spaceport.log
stdout_logfile_maxbytes=100MB

```

After editing a config file, load the changes:

```
$ sudo supervisorctl reread; sudo supervisorctl update
```
