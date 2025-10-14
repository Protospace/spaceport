# Vestaboard Integration

Protoflap is how the Welcome Room's Vestaboard gets messages from the portal.

## Theory

The Vestaboard's Raspberry Pi runs a python script called Protoflap that continuously polls the Spaceport's `/stats/` API route.

Members can send messages to the marquee LED sign + Vestaboard from both the portal and Protovac, or to the Vestaboard only from the portal. The messages are handled by `sign(...)` and `vestaboard(...)` in  [views.py](https://github.com/Protospace/spaceport/blob/master/apiserver/apiserver/api/views.py). 

If you want to write a message programmatically, POST `vestaboard=your message` to `https://api.my.protospace.ca/stats/vestaboard/`. See below for examples.

The following special characters are supported:    
`\w`: white block, `\r`: red block, `\o`: orange block, `\y`: yellow block, `\g`: green block, `\b`: blue block, `\v`: violet block, `\d`: degree symbol

The Protoflap code lives here:    
https://github.com/Protospace/protoflap

## Setup

Follow instructions in the Protoflap README.

The script is kept alive with [Supervisor](Supervisor.md).

## Examples

Here are examples for sending your own custom message to the Vestaboard.

Bash:
```
$ curl -d 'vestaboard=Hello World' https://api.my.protospace.ca/stats/vestaboard/
```

Python:
```
import requests

def send_vestaboard_message(message):
    url = "https://api.my.protospace.ca/stats/vestaboard/"
    data = {'vestaboard': message}
    response = requests.post(url, data=data)
    return response.text

# Usage:
send_vestaboard_message("Hello World")
```

JavaScript:
```
function sendVestaboardMessage(message) {
  fetch('https://api.my.protospace.ca/stats/vestaboard/', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: `vestaboard=${encodeURIComponent(message)}`
  })
  .then(response => response.text())
  .then(data => console.log(data))
  .catch(error => console.error('Error:', error));
}

// Usage:
sendVestaboardMessage('Hello World');
```

