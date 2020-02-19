#!/bin/bash

# be safe
set -euf -o pipefail

# test these carefully
#find "${backup_folder}" -mindepth 1 -type d -print
#find "${backup_folder}" -mindepth 1 -type d -ctime +14 -print
#find "${backup_folder}" -mindepth 1 -type d -ctime +14 -exec rm -r {} \;
