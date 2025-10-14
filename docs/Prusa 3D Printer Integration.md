# Prusa 3D Printer Integration

The portal tracks the status of the Prusa XL 3D printer.

## Theory

The integration's code is here:

https://github.com/Protospace/telemetry/tree/master/prusa_tracker

It's a stripped down version of the [Bambu 3D Printer Integration](Bambu%203D%20Printer%20Integration.md).

This python script runs on a server (right now Tanner's "dev server", hosted on Proxmox). It's kept running with [Supervisor](Supervisor.md). One instance of the script runs per 3D printer (right now there's only one Prusa). Every 60 seconds it polls the Home Assistant API and gets the state of all entities. It filters those entities by the printer's name and then sends the data to the portal.

The data is handled by `printer3d(...)` in  [views.py](https://github.com/Protospace/spaceport/blob/master/apiserver/apiserver/api/views.py). The data gets written directly to a global `printer3d` dictionary that then gets read when the `/stats/` route is polled. This is used in the "Protospace Stats" section of the portal's Home page to display when the printers are in use.

## Setup

Generate API keys in Home Assistant and configure them in `secrets.py`. You'll need to run the script like this, for example:

```
python main.py prusa_xl
```

[Supervisor](Supervisor.md) config:

```
[program:prusa]
user=tanner
directory=/home/tanner/telemetry/prusa_tracker
environment=PYTHONUNBUFFERED=TRUE
command=/home/tanner/telemetry/prusa_tracker/env/bin/python main.py prusa_xl
stopasgroup=true
stopsignal=INT
autostart=true
autorestart=true
stderr_logfile=/var/log/prusa.log
stderr_logfile_maxbytes=10MB
stdout_logfile=/var/log/prusa.log
stdout_logfile_maxbytes=10MB
```