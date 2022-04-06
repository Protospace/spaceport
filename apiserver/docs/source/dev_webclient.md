# Web Client Development Setup

This guide assumes you are using Debian GNU/Linux 11 or Ubuntu 20.04 LTS. If you
aren't, just spin up a VM with the correct version. Things break if you don't.

## Install Dependencies

```
$ sudo apt update
$ sudo apt install nodejs npm
$ sudo npm install --global yarn
```

Clone the repo. Skip this step if you already have it:

```
$ git clone https://github.com/Protospace/spaceport.git
```

Set up nodejs:

```
$ cd spaceport/webclient/
$ yarn install
```

## Running

Run the development server:

```
$ HOST=0.0.0.0 yarn start
```

You'll see about 500 warnings which you can safely ignore or help get rid of.

The development server is now listening on port 3000. You can connect to it by
opening `http://<ip address>:3000/` in your web browser. If it's running
locally, that would be [http://127.0.0.1:3000/](http://127.0.0.1:3000/).
