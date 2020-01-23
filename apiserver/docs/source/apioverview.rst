API Overview
============

The current API URL is: https://api.spaceport.dns.t0.vc/

The Spaceport API uses REST. JSON is returned by all API responses including
errors and HTTP response status codes are to designate success and failure.

Request bodies can be JSON or form data.

API Routes
----------

All API routes require a trailing slash. This is a Django default and you'll get
a 301 redirect if you forget it.

Authentication
--------------

All API routes except for ``/door/`` require authentication with a token. The
token is returned on registration and login. The token needs to be placed in the
``Authorization`` request header like this: ``Token <token>``.

**Example**

Login response:

.. sourcecode:: json

    {"key":"1fb8ef73f118c5de1f9ba4939a76b3f3b0bc7444"}

Add the following header to requests:

.. sourcecode:: text

    Authorization: Token 1fb8ef73f118c5de1f9ba4939a76b3f3b0bc7444


Quick Reference
---------------

.. http:post:: /registration/
.. http:post:: /rest-auth/login/
.. http:get:: /user/
.. http:post:: /password/change/
.. http:get:: /members/(id)/
.. http:post:: /members/
.. http:patch:: /members/(id)/
.. http:put:: /members/(id)/
.. http:post:: /members/(id)/pause/
.. http:post:: /members/(id)/unpause/
.. http:post:: /search/
.. http:get:: /search/(id)/
.. http:get:: /transactions/(id)/
.. http:post:: /transaction/
.. http:patch:: /transactions/(id)
.. http:put:: /transactions/(id)/
.. http:get:: /courses/
.. http:get:: /courses/(id)/
.. http:post:: /courses/
.. http:put:: /courses/(id)/
.. http:patch:: /courses/(id)/
.. http:get:: /sessions/
.. http:get:: /sessions/(id)/
.. http:post:: /sessions/
.. http:put:: /sessions/(id)/
.. http:patch:: /sessions/(id)/
.. http:get:: /training/(id)/
.. http:post:: /training/
.. http:put:: /training/(id)/
.. http:patch:: /training/(id)/
.. http:get:: /cards/(id)/
.. http:post:: /cards/
.. http:put:: /cards/(id)/
.. http:patch:: /cards/(id)/
.. http:delete:: /cards/(id)/
.. http:get:: /door/
.. http:post:: /door/(card_number)/seen/
