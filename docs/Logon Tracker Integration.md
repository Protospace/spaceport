# Logon Tracker Integration

The Logon Tracker periodically sends a logged on user's username to the portal.

## Theory

The code for it is here:

https://github.com/Protospace/telemetry/tree/master/logon_tracker

It's a Powershell script that sends a POST request to the portal's `/stats/track/` every 10 seconds. The data contains the username and the computer's name.

The data is handled by `track(...)` in [views.py](https://github.com/Protospace/spaceport/blob/master/apiserver/apiserver/api/views.py). When data is received, it gets put into a global `track` dictionary that then gets read when the `/stats/` route is polled. This is used in the "Protospace Stats" section of the portal's Home page to display when certain computers are in use.


## Setup

Author is unfamiliar with how it gets ran on Windows computers, ask Pat.
