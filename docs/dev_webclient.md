# Web Client Development Setup

This guide assumes you are using [Debian GNU/Linux 11](https://cdimage.debian.org/cdimage/unofficial/non-free/images-including-firmware/archive/11.2.0+nonfree/amd64/iso-cd/firmware-11.2.0-amd64-netinst.iso) or [Ubuntu 20.04 LTS](https://releases.ubuntu.com/20.04/). If you
aren't, just spin up a VM with the correct version. Support is unavailable for other operating systems.

NOTE: on windows, if you have a more modern node version (eg 20+) installed, you can use the `xxx:win:legacy` powershell scripts to build and run the project locally. Just follow the other instructions in the readme first.

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
Alternatively, you can run one of the `start` script in the package-json file.
You'll see some warnings which you can safely ignore or help get rid of.

The development server is now listening on port 3000. You can connect to it by
opening `http://<ip address>:3000/` in your web browser. If it's running
locally, that would be [http://127.0.0.1:3000/](http://127.0.0.1:3000/).
