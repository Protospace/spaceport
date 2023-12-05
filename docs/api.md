# Spaceport API

The current API URL is: [https://api.my.protospace.ca/](https://api.my.protospace.ca/).

JSON is returned by all API responses including errors and HTTP response status
codes are to designate success and failure.

Request bodies can be JSON or form data.

All API routes require a trailing slash. This is a Django default and you'll get
a 301 redirect if you forget it.

## Authentication

Most API routes require authentication with a token. The token is returned on
registration and login. The token needs to be placed in the `Authorization`
request header like this: `Token <token>`.

**Example**

Login request:

```
$ curl -d 'username=tanner.collin' -d 'password=supersecret' 'https://my.protospace.ca/rest-auth/login/'
```

Login response:

```
{"key":"1fb8ef73f118c5de1f9ba4939a76b3f3b0bc7444"}
```

Add the following header to requests:

```
Authorization: Token 1fb8ef73f118c5de1f9ba4939a76b3f3b0bc7444
```

/user/ request:

```
curl -H 'Authorization: Token 1fb8ef73f118c5de1f9ba4939a76b3f3b0bc7444' 'https://my.protospace.ca/user/'
```

## API Routes

API routes are not documented. They (used to be)[https://github.com/Protospace/spaceport/blob/5bf9b261802001b8038eba2dd272020fab0c0ebd/apiserver/docs/source/api.rst] but the utility for how much
effort it took was not worth it.

Use your browser's network inspector to learn how the API works.
