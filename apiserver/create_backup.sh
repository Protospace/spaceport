#!/bin/bash

# be safe
set -euf -o pipefail


uuid="`cat /proc/sys/kernel/random/uuid`"
date="`date -I`"

api_folder="/opt/spaceport/apiserver"
data_folder="/opt/spaceport/apiserver/data"
backup_folder="/opt/spaceport/apiserver/backups"

file_name="spaceport-backup-${date}.tar.gz"
path_name="${backup_folder}/${uuid}"
full_name="${path_name}/${file_name}"

mkdir "${path_name}"
tar -czf "${full_name}" --directory "${api_folder}" data/

echo "Wrote backup to: ${uuid}/${file_name}"

/opt/spaceport/apiserver/env/bin/python \
	/opt/spaceport/apiserver/manage.py \
	set_backup_path	"${uuid}/${file_name}"

# test these carefully
find "${backup_folder}" -mindepth 1 -type d -print
#find "${backup_folder}" -mindepth 1 -type d -ctime +14 -print
#find "${backup_folder}" -mindepth 1 -type d -ctime +14 -exec rm -r {} \;
