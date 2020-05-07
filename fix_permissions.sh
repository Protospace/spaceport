#!/bin/bash

# restrict everything
chown -R spaceport:spaceport .
chmod -R ug=rwX,o= .

# allow access to static folders
chmod o=rX .

chmod o=rX webclient/
chmod -R o=rX webclient/build/


chmod o=rX apiserver/

chmod o=rX apiserver/data/
chmod -R o=rX apiserver/data/static/
chmod -R o=rX apiserver/backups/

chmod o=rX apiserver/docs/
chmod o=rX apiserver/docs/build/
chmod -R o=rX apiserver/docs/build/html
