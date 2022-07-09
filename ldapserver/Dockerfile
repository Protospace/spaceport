from python:3.8

RUN mkdir /ldapserver
WORKDIR /ldapserver
CMD python server.py

RUN apt-get update
RUN apt install libsasl2-dev libldap2-dev libssl-dev -y

COPY requirements.txt .
RUN pip install -r requirements.txt

COPY . /ldapserver
