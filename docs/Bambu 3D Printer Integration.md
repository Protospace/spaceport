# Bambu 3D Printer Integration

The portal tracks the status of the two Bambu P1S 3D printers and displays their camera feeds on a screen.

## Theory

The integration's code is here:

https://github.com/Protospace/telemetry/tree/master/bamboo_tracker

Bambu is misspelled because the author didn't know any better.

### Portal Stats

This python script runs on the [Integrations Server](Integrations%20Server.md). It's kept running with [Supervisor](Supervisor.md). One instance of the script runs per 3D printer. Every 60 seconds it polls the Home Assistant API and gets the state of all entities. It filters those entities by the printer's serial number and then sends the data to the portal.

The data is handled by `printer3d(...)` in  [views.py](https://github.com/Protospace/spaceport/blob/master/apiserver/apiserver/api/views.py). The data gets written directly to a global `printer3d` dictionary that then gets read when the `/stats/` route is polled. This is used in the "Protospace Stats" section of the portal's Home page to display when the printers are in use.

### TV Display

Every second the script also polls Home Assistant's camera feed for that printer. The image gets saved as `p1s1/pic.jpg` or `p1s2/pic.jpg`. Those two directories are then served statically by the python script. The `DisplayBambuCamera(...)` component in [Display.js](https://github.com/Protospace/spaceport/blob/master/webclient/src/Display.js) then loads them from an nginx proxy running locally on the LCARS3 display in the sewing room. The local proxy is used to bypass HTTPS / CORS.

## Setup

### Server

Set the python script up to run automatically, one time for each printer. Generate API keys in Home Assistant and configure them in `secrets.py`. You'll need to run the script like this, for example:

```
python main.py p1s1 1234123412341234 8080
python main.py p1s2 abcdabcdabcdabcd 8081
```

Make sure ports 8080 and 8081 aren't blocked.

[Supervisor](Supervisor.md) config:

```
[program:p1s1]
user=tanner
directory=/home/tanner/telemetry/bamboo_tracker
environment=PYTHONUNBUFFERED=TRUE
command=/home/tanner/telemetry/bamboo_tracker/env/bin/python main.py p1s1 1234123412341234 8081
stopasgroup=true
stopsignal=INT
autostart=true
autorestart=true
stderr_logfile=/var/log/p1s1.log
stderr_logfile_maxbytes=10MB
stdout_logfile=/var/log/p1s1.log
stdout_logfile_maxbytes=10MB

[program:p1s2]
user=tanner
directory=/home/tanner/telemetry/bamboo_tracker
environment=PYTHONUNBUFFERED=TRUE
command=/home/tanner/telemetry/bamboo_tracker/env/bin/python main.py p1s2 abcdabcdabcdabcd 8082
stopasgroup=true
stopsignal=INT
autostart=true
autorestart=true
stderr_logfile=/var/log/p1s2.log
stderr_logfile_maxbytes=10MB
stdout_logfile=/var/log/p1s2.log
stdout_logfile_maxbytes=10MB
```

### LCARS3 TV Display

Install nginx, configure `/etc/nginx/sites-available/default`:

```
server {
    listen 80;

    root /var/www/html;
    index index.html index.htm;

    server_name localhost;

    location /p1s1 {
        proxy_pass http://172.17.17.181:8081;
        proxy_set_header Host $http_host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        add_header Access-Control-Allow-Origin *;

        # kill cache
        add_header 'cache-control' 'no-cache' always;
        if_modified_since off;
        expires off;
        etag off;
        proxy_no_cache 1;
        proxy_cache_bypass 1;
    }

    location /p1s2 {
        proxy_pass http://172.17.17.181:8082;
        proxy_set_header Host $http_host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        add_header Access-Control-Allow-Origin *;

        # kill cache
        add_header 'cache-control' 'no-cache' always;
        if_modified_since off;
        expires off;
        etag off;
        proxy_no_cache 1;
        proxy_cache_bypass 1;
    }
}
```


Where `172.17.17.181` is the IP of the server where the python script is running.