# Todo List Integration

Protospace uses [Vikunja](https://github.com/go-vikunja/vikunja) to track todo lists. This document describes setting up the portal auth integration.

## Integration Setup

Install and set up Vikunja according to their installation docs.

### Django OIDC Provider:

```
$ cd apiserver/
$ source env/bin/activate
(env) $ pip install django-oidc-provider
(env) $ python manage.py migrate
(env) $ python manage.py creatersakey
```

Log into the Django admin site and add an Oidc_Provider client object:

- Name: vikunja
- Owner: blank
- Client Type: confidential
- Response Type: code (Authorization Code Flow)
- Redirect URIs: https://todo.protospace.ca/auth/openid/spaceport
- JWT Algorithm: RS256
- Require Consent? No
- Reuse Consent? Yes
- Scopes: openid profile email vikunja_scope

Hit save and copy the Client ID and Client Secret.

### Vikunja:

Edit `config.yml`:

```
auth:
  local:
    enabled: false
  openid:
    enabled: true
    redirecturl: https://todo.protospace.ca/auth/openid/spaceport
    providers:
      - name: "spaceport"
        authurl: https://api.my.protospace.ca/openid
        clientid: 111111
        clientsecret: aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa
        scope: openid profile email vikunja_scope
```

