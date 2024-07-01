# Running the Development Setup

This document explains how to actually use Spaceport after you have the API
server and web client set up.

It assumes the API server is running on [http://127.0.0.1:8000/](http://127.0.0.1:8000/) and the web
client is [http://127.0.0.1:3000/](http://127.0.0.1:3000/) you can replace `127.0.0.1` with whatever the
IP if your virtual machine or server is.

## Register the First Member

Open the web client [http://127.0.0.1:3000/](http://127.0.0.1:3000/) in your browser.

Fill out the "Sign Up to Spaceport" form. If you see a "Please Visit Protospace"
warning, this means the web client can't talk to the API server properly. Hit
Sign Up and finish the registration.

The first user is automatically granted superuser, staff, and vetted status. You should
be able to log into the Django admin panel at
[http://127.0.0.1:8000/admin/](http://127.0.0.1:8000/admin/) if you want to edit database values.

## Running Cron Jobs

Spaceport runs commands periodically to manage infomation that changes with
time and generate the stats. Running them is optional and you can run them
manually like so:

```
$ source env/bin/activate
(env) $ DEBUG=true python manage.py run_minutely
(env) $ DEBUG=true python manage.py run_hourly
(env) $ DEBUG=true python manage.py run_daily
```

Or automatically:

```
$ crontab -e
```

Add to the bottom of the file:

```
10 10 * * * /whatever/spaceport/apiserver/env/bin/python /whatever/spaceport/apiserver/manage.py run_daily
58 * * * * /whatever/spaceport/apiserver/env/bin/python /whatever/spaceport/apiserver/manage.py run_hourly
* * * * * /whatever/spaceport/apiserver/env/bin/python /whatever/spaceport/apiserver/manage.py run_minutely
```

Replace `whatever` with the path to Spaceport.
