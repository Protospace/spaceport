# PayPal Integration

The PayPal integration is an essential part of Spaceport because the overwhelming majority of membership dues are sent through PayPal.

Spaceport is unable to request or prevent a payment from PayPal or manage subscriptions. It only gets notified that a payment to our PayPal account has taken place.

If a member asks to go on vacation, they need to cancel their own subscription. If a member asks to change their dues amount, they’ll need to cancel the existing subscription and then set up a new one. The “monthly dues” field on each members’ profile only changes what the subscription buttons do, and helps calculate the number of months to credit.

## Theory

PayPal uses [Instant Payment Notifications](https://developer.paypal.com/api/nvp-soap/ipn/IPNIntro/) (IPNs) to inform Spaceport of payments, subscriptions, cancellations, refunds, etc. IPNs are essentially webhooks.

PayPal POSTs URL-encoded form data to an obfuscated Spaceport URL defined in [urls.py](https://github.com/Protospace/spaceport/blob/master/apiserver/apiserver/urls.py). The URL is in the format `https://api.my.protospace.ca/ipn/[secrets.IPN_RANDOM]/`. Form data is received by the `IpnView(...)` class in [views.py](https://github.com/Protospace/spaceport/blob/master/apiserver/apiserver/api/views.py).

The data is then passed to `process_paypal_ipn(...)` in [utils_paypal.py](https://github.com/Protospace/spaceport/blob/master/apiserver/apiserver/api/utils_paypal.py) where it's verified, parsed, and processed. Data is immediately sent back to PayPal to confirm it's authentic. Only payment notifications are considered. Incomplete payments, subscriptions, cancellations, refunds, etc. are ignored for now.

The transaction is processed to figure out who and what it's for. If it was initiated by the Spaceport web client, it will have a bit of JSON data included that's used as a hint. Otherwise it's looked at heuristically to determine the reason why the payment was made. This is needed because many subscriptions were made before Spaceport existed, using the old portal.

The `PayPalHint` database table is used to help associate PayPal accounts with Spaceport members. It gets "trained" any time a transaction is correctly matched or a manual correction is made.

If the reason or member can't be determined, the transaction is flagged as "reported" and shows up on the [Admin Transaction](https://my.protospace.ca/admintrans) page for a Director to sort later.

Once the transaction is processed, Spaceport will return an HTTP `200 OK`. If PayPal doesn't receive this response, it will retry sending the IPN periodically. This happens sometimes when the database is locked for routine cleaning.

## Setup

Set `IPN_RANDOM` in [secrets.py](https://github.com/Protospace/spaceport/blob/master/apiserver/apiserver/secrets.py.example). Log into Protospace's PayPal account and enable IPNs, setting the URL as described above.
