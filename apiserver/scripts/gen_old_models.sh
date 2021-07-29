#!/bin/bash

python manage.py inspectdb --database old_portal | sed 's/CharField/TextField/g' > apiserver/api/old_models.py
