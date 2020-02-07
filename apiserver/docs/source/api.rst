API
===

.. contents:: :depth: 3

User
----

Registration
++++++++++++

.. http:post:: /registration/

    Register an account on Spaceport. Only works from Protospace's IP addresses.

    :json first_name:
    :json last_name:
    :json username: Should be ``first.last``
    :json password1:
    :json password2:
    :json email:
    :json boolean existing_member: If ``true``, will link old portal objects based
        on email match.

    **Example response**:

    .. sourcecode:: json

        {"key":"1fb8ef73f118c5de1f9ba4939a76b3f3b0bc7444"}

Login
+++++

.. http:post:: /rest-auth/login/

    Log in with username and password, responds with auth token.

    Put the token in the ``Authorization`` HTTP header like ``Token <token>`` to
    authenticate.

    :json username:
    :json password:

    **Example request**:

    .. sourcecode:: bash

        $ curl \
            -d '{"username":"tanner.tester", "password":"supersecret"}' \
            -H "Content-Type: application/json" \
            -X POST \
            http://api.spaceport.dns.t0.vc/rest-auth/login/

    **Example response**:

    .. sourcecode:: json

        {"key":"1fb8ef73f118c5de1f9ba4939a76b3f3b0bc7444"}

Full User
+++++++++

.. http:get:: /user/

    Retrieve an object with complete user data.

    :requestheader Authorization: ``Token <token>``

    **Example request**:

    .. sourcecode:: bash

        $ curl \
            -H "Authorization: Token 1fb8ef73f118c5de1f9ba4939a76b3f3b0bc7444" \
            https://api.spaceport.dns.t0.vc/user/

    **Example response**:

    .. sourcecode:: json

        {
            "id": 113,
            "username": "tanner.tester",
            "member": {
                "id": 1685,
                "status": "Current",
                "email": "text",
                "phone": "text",
                "street_address": "text",
                "city": "text",
                "postal_code": "text",
                "old_email": "text",
                "photo_large": "uuid.jpg",
                "photo_medium": "uuid.jpg",
                "photo_small": "uuid.jpg",
                "member_forms": "uuid.pdf",
                "set_details": true,
                "first_name": "Tanner",
                "last_name": "Collin",
                "preferred_name": "Tanner",
                "emergency_contact_name": "text",
                "emergency_contact_phone": "text",
                "birthdate": null,
                "is_minor": false,
                "guardian_name": "",
                "is_director": false,
                "is_staff": true,
                "is_instructor": false,
                "expire_date": "2020-01-23",
                "current_start_date": "2016-08-23",
                "application_date": "2016-08-23",
                "vetted_date": "2016-09-27",
                "paused_date": null,
                "monthly_fees": 50,
                "user": 113
            },
            "transactions": [
                {
                    "id": 31783,
                    "account_type": "PayPal",
                    "info_source": "PayPal IPN",
                    "member_name": "Tanner Collin",
                    "date": "2019-12-22",
                    "member_id": 1685,
                    "amount": "50.00",
                    "reference_number": "text",
                    "memo": "text",
                    "number_of_membership_months": null,
                    "payment_method": null,
                    "category": "Memberships:PayPal Payments",
                    "user": 113,
                    "recorder": null
                }
            ],
            "cards": [
                {
                    "id": 392,
                    "member_id": 1685,
                    "card_number": "text",
                    "notes": "Tanner Collin",
                    "last_seen_at": "2020-01-20",
                    "active_status": "card_active",
                    "user": 113
                }
            ],
            "training": [
                {
                    "id": 971,
                    "session": {
                        "id": 11073,
                        "student_count": 20,
                        "course_name": "Metal: Metal Cutting &amp; Manual Lathe",
                        "instructor_name": "John W",
                        "datetime": "2016-09-17T16:00:00Z",
                        "course": 281,
                        "is_cancelled": false,
                        "old_instructor": "John W",
                        "cost": "10.00",
                        "max_students": null,
                        "instructor": null
                    },
                    "member_id": 1685,
                    "attendance_status": "Confirmed",
                    "sign_up_date": null,
                    "paid_date": null
                }
            ],
            "is_staff": true
        }

    :json is_staff: Set in Django's admin panel. You'll need to set this for the
        first user so that you can assign more admins.
    :json member.is_staff: Set by directors / staff in UI.

Change Password
+++++++++++++++

.. http:post:: /password/change/

    :json old_password:
    :json password1:
    :json password2:

    **Example response**:

    .. sourcecode:: json

        {"detail":"New password has been saved."}


Members
-------

Member Details
++++++++++++++

.. http:get:: /members/(id)/

    Retrieve an object with member details. Users can only view themselves,
    admins can view anyone.

    :param id:

    :requestheader Authorization: ``Token <token>``

    **Example request**:

    .. sourcecode:: bash

        $ curl \
            -H "Authorization: Token 1fb8ef73f118c5de1f9ba4939a76b3f3b0bc7444" \
            https://api.spaceport.dns.t0.vc/members/1685/

    **Example response**:

    .. sourcecode:: json

        {
            "id": 1685,
            "status": "Current",
            "email": "text",
            "phone": "text",
            "street_address": "text",
            "city": "text",
            "postal_code": "text",
            "old_email": "text",
            "photo_large": "uuid.jpg",
            "photo_medium": "uuid.jpg",
            "photo_small": "uuid.jpg",
            "member_forms": "uuid.pdf",
            "set_details": true,
            "first_name": "Tanner",
            "last_name": "Collin",
            "preferred_name": "Tanner",
            "emergency_contact_name": "text",
            "emergency_contact_phone": "text",
            "birthdate": null,
            "is_minor": false,
            "guardian_name": "",
            "is_director": false,
            "is_staff": false,
            "is_instructor": false,
            "expire_date": "2020-01-23",
            "current_start_date": "2016-08-23",
            "application_date": "2016-08-23",
            "vetted_date": "2016-09-27",
            "paused_date": null,
            "monthly_fees": 50,
            "user": 113
        }

    :json member.old_email: From old portal import, used to claim member when
        registering.
    :json \*.member_id: From old portal import, used as a hint to link the
        object to users when they claim their old member.
    :json photo\_\*: Should be served by nginx on the ``static`` subdomain. Refers
        to photo filenames in the ``apiserver/data/static`` directory.
    :json member_forms: Should be served by nginx on the ``static`` subdomain.
    :json status: Derived by subtracting today's date from expire_date.  More
        than one month: Prepaid, less than one month: Current, less than one
        month behind: Due, more than one month behind: Overdue.  Members more
        than three months behind are paused.  Value stored to make searching
        faster.
    :json expire_date: Derived by summing all member transaction's
        number_of_membership_months and adding to member's current_start_date.
        Value stored to make searching faster.

.. http:post:: /members/

    Not allowed. Object is created upon registration.

Edit Member Details
+++++++++++++++++++

.. http:patch:: /members/(id)/

    Set member details.

    Member PDF forms will automatically be regenerated on any change.

    **Users**

    Can only set certain fields of their own member.

    :form photo: A member photo that will be turned into different sizes and
        referred to by photo_large, photo_medium, photo_small.

    :json email:
    :json phone:
    :json street_address:
    :json city:
    :json postal_code:
    :json boolean set_details: Set true if they've filled out the new member
        form on sign up so the UI stops showing it.
    :json preferred_name: What's shown throughout the UI.
    :json emergency_contact_name: optional
    :json emergency_contact_phone: optional
    :json birthdate: optional, YYYY-MM-DD
    :json boolean is_minor:
    :json guardian_name: optional

    **Admins**

    Can modify any member. Above fields, plus:

    :json first_name:
    :json last_name:
    :json boolean is_director: Grants admin privileges to member.
    :json boolean is_staff: Same as director, just not named one.
    :json boolean is_instructor: Able to create and edit courses and sessions.
    :json application_date: When they applied to Protospace, YYYY-MM-DD.
    :json current_start_date: When to start counting their membership dues from.
        Would only differ from application_date for accounting reasons, YYYY-MM-DD.
    :json vetted_date: YYYY-MM-DD
    :json monthly_fees: for display only

    :requestheader Authorization: ``Token <token>``

    **Response**

    Same as GET.

.. http:put:: /members/(id)/

    Same as PATCH but requires all fields present.

Pausing / Unpausing Member
++++++++++++++++++++++++++

.. http:post:: /members/(id)/pause/
               /members/(id)/unpause/

    Pause or unpause a membership. Can only be done by admins.

    Pausing a member sets their paused_date to today. Their cards aren't sent to
    the door controller. Their expire_date and status won't be evaluated daily
    any longer.

    Unpausing a member sets their current_start_date to their paused_date. Their
    paused_date is then set to null. They will be Due. Their active cards will
    begin working again.

    :param id:

    :requestheader Authorization: ``Token <token>``

    **Response**

    :status 200:


Search
------

Searching
+++++++++

.. http:post:: /search/

    Perform a search for members' names.

    Exact prefix matches are returned first, then exact substring matches, then
    fuzzy matches.

    POST is used because our auth header causes a pre-flight request. These
    can't be cached if the URL keeps changing like with query params. Using the
    request body for the query prevents an OPTIONS request per keystroke.

    Designed to be fast enough for incremental search.

    An empty search returns the most recently vetted members.

    :json q: The search query.
    :json int seq: An integer that gets returned with the search results.
        Useful to prevent responses that arrive out-of-order from being
        displayed as search results. ``event.timeStamp()`` is a good value to use.

    :requestheader Authorization: ``Token <token>``

    **Example response**:

    .. sourcecode:: json

        {
            "seq": 12345,
            "results": [
                {
                    "member": {
                        "id": 1685,
                        "preferred_name": "Tanner",
                        "last_name": "Collin",
                        "status": "Current",
                        "current_start_date": "2016-08-23",
                        "photo_small": "uuid.jpg",
                        "photo_large": "uuid.jpg"
                    }
                },
                {
                    "member": {
                        "id": 1993,
                        "preferred_name": "Tanner",
                        "last_name": "text",
                        "status": "Former Member",
                        "current_start_date": null,
                        "photo_small": null,
                        "photo_large": null
                    }
                }
            ]
        }

Search Result
+++++++++++++

.. http:get:: /search/(id)/

    Returns a specific search result. Users can see a partial member object. Admins can see the full member, cards, and transactions.

    :param id:

    :requestheader Authorization: ``Token <token>``

    **Example user response**:

    .. sourcecode:: json

        {
            "member": {
                "id": 1685,
                "preferred_name": "Tanner",
                "last_name": "Collin",
                "status": "Current",
                "current_start_date": "2016-08-23",
                "photo_small": "uuid.jpg",
                "photo_large": "uuid.jpg"
            }
        }

    **Example admin response**:

    Truncated.

    .. sourcecode:: json

        {
            "member": {},
            "cards": [],
            "transactions": [],
        }


Transactions
------------

Transaction Details
+++++++++++++++++++

.. http:get:: /transactions/(id)/

    Retrieve a transaction. Users can only view their own. Admins can view
    anyone's.

    :param id:

    :requestheader Authorization: ``Token <token>``

    **Example response**:

    .. sourcecode:: json

        {
            "id": 40720,
            "account_type": "PayPal",
            "info_source": "PayPal IPN",
            "member_id": 1685,
            "member_name": "Tanner Collin",
            "date": "2020-01-30",
            "report_type": null,
            "amount": "100.00",
            "reference_number": "234236326",
            "memo": "1685, text, email, etc",
            "number_of_membership_months": 2,
            "payment_method": "instant",
            "category": "Memberships:PayPal Payments",
            "paypal_txn_id": "234236326",
            "paypal_payer_id": "123ABCDEFGHIJ",
            "report_memo": null,
            "user": 2,
            "recorder": null
        }


Reported Transactions
+++++++++++++++++++++

.. http:get:: /transactions/

    Retrieve a list of reported transactions. Admins only.

    Reported transactions are one with a report_type not null.

    :requestheader Authorization: ``Token <token>``

    **Example response**

    Truncated.

    .. sourcecode:: json

        {
            "count": 6,
            "next": null,
            "previous": null,
            "results": [
                {
                    "id": 40715,
                    "etc": "...",
                },
                {
                    "id": 40716,
                    "etc": "...",
                },
                {
                    "id": 40717,
                    "etc": "...",
                }
            ]
        }

Create Transaction
++++++++++++++++++

.. http:post:: /transactions/

    Add a transaction to a member. Admins only.

    :json date: YYYY-MM-DD
    :json int member_id: Which member the transaction belongs to.
    :json decimal amount: Positive is money going to Protospace, XX.XX.
    :json account_type: One of: ``Interac``, ``TD Chequing``, ``Dream Pmt``,
        ``PayPal``, ``Square Pmt``, ``Member``, ``Clearing``, ``Cash``
    :json info_source: One of: ``Web``, ``DB Edit``, ``System``, ``Receipt or Stmt``, ``Quicken
        Import``, ``PayPal IPN``, ``Auto``, ``Nexus DB Bulk``, ``IPN Trigger``,
        ``Intranet Receipt``, ``Automatic``, ``Manual``
    :json number_of_membership_months: Used when calculating member status and
        expire date, optional.
    :json reference_number: optional
    :json memo: optional
    :json payment_method: optional
    :json category: optional
    :json report_type: One of: ``null``, ``Unmatched Member``, ``Unmatched Purchase``,
        ``User Flagged``
    :json report_memo: The reason for the report, optional.

    :requestheader Authorization: ``Token <token>``

    **Response**

    Same as GET.

Edit Transaction
++++++++++++++++++

.. http:patch:: /transactions/(id)

    Same fields as POST. Admins only.

    :param id: The transaction's ID.

    :requestheader Authorization: ``Token <token>``

.. http:put:: /transactions/(id)/

    Same as PATCH but requires all fields present.

Report Transaction
++++++++++++++++++

.. http:post:: /transactions/(id)/report/

    Allows users to report their own transactions for review.

    ``report_type`` will automatically be set to ``User Flagged``.

    :param id: The transaction's ID.

    :json report_memo: The reason for the report, required.

    :requestheader Authorization: ``Token <token>``

    **Response**

    :status 200:


Courses
-------

.. http:get:: /courses/

    List of all courses, ordered by which has most upcoming session.

    Truncated.

    .. sourcecode:: json

        {
            "count": 59,
            "next": null,
            "previous": null,
            "results": [
                {
                    "id": 261,
                    "name": "Woodworking Tools 1: Intro to Saws"
                },
                {
                    "id": 321,
                    "name": "Laser: Trotec Course"
                }
            ]
        }

.. http:get:: /courses/(id)/

    :param id: The course's ID.

    .. sourcecode:: json

        {
            "id": 417,
            "sessions": [
                {
                    "id": 12375,
                    "student_count": 11,
                    "course_name": "HAM Radio Introduction",
                    "instructor_name": "Pat S",
                    "datetime": "2019-01-24T02:00:00Z",
                    "course": 417,
                    "is_cancelled": false,
                    "old_instructor": "Pat S",
                    "cost": "0.00",
                    "max_students": null,
                    "instructor": null
                }
            ],
            "name": "HAM Radio Introduction",
            "description": "text",
            "is_old": true
        }

    :json boolean is_old: True if imported from old portal.
    :json description: Text separated by \\n if is_old, otherwise HTML.

.. http:post:: /courses/
.. http:put:: /courses/(id)/
.. http:patch:: /courses/(id)/

    Instructors and admins only.

    :param id: The course's ID.

    :json name:
    :json boolean is_old:
    :json description:

    :requestheader Authorization: ``Token <token>``



Sessions
--------

    Classes are called sessions in the API because of old portal models
    and "class" keyword conflict.

    A session (class) belongs to a course and has a specific date, time,
    instructor, and cost.

.. http:get:: /sessions/

    List of the 20 next sessions.

    Truncated.

    .. sourcecode:: json

        {
            "count": 20,
            "next": null,
            "previous": null,
            "results": [
                {
                    "id": 13476,
                    "student_count": 0,
                    "course_name": "CAD: Introduction to 3D CAD (Fusion)",
                    "instructor_name": "Mike M",
                    "datetime": "2020-01-18T16:30:00Z",
                    "course": 253,
                    "is_cancelled": false,
                    "old_instructor": "Mike M",
                    "cost": "0.00",
                    "max_students": null,
                    "instructor": null
                }
            ]
        }

    :json student_count: Number of students registered, excluding withdrawn.


.. http:get:: /sessions/(id)/

    :param id: The course's ID.

    .. sourcecode:: json

        {
            "id": 13476,
            "student_count": 0,
            "course_name": "CAD: Introduction to 3D CAD (Fusion)",
            "instructor_name": "Mike M",
            "datetime": "2020-01-18T16:30:00Z",
            "course": 253,
            "students": [],
            "is_cancelled": false,
            "old_instructor": "Mike M",
            "cost": "0.00",
            "max_students": null,
            "instructor": null
        }

.. http:post:: /sessions/
.. http:put:: /sessions/(id)/
.. http:patch:: /sessions/(id)/

    Instructors and admins only.

    :param id: The session's ID.

    :json datetime: UTC ISO 8601, YYYY-MM-DDTHH:MM:SSZ
    :json int course: ID of the course it belongs to.
    :json boolean is_cancelled: Only for display.
    :json decimal cost: 0 if free.
    :json int max_students: optional

    :requestheader Authorization: ``Token <token>``


Training
--------

    A training object is created when a member registers for a session (class).

.. http:get:: /training/(id)/

    Retrieve a training object. Users can only view their own. Instructors can
    view their students'. Admins can view anyone's.

    :param id: The training object's ID.

    :requestheader Authorization: ``Token <token>``

    .. sourcecode:: json

        {
            "id": 971,
            "attendance_status": "Confirmed",
            "session": 11073,
            "student_name": "Tanner Collin",
            "member_id": 1685,
            "sign_up_date": null,
            "paid_date": null,
            "user": 113
        }

.. http:post:: /training/

    Register for a session (class).

    **Users**

    :json attendance_status: One of: ``Waiting for payment``, ``Withdrawn``
    :json int session: The session (class) to register for.

    **Instructors and Admins**

    :json attendance_status: One of: ``Waiting for payment``, ``Withdrawn``,
        ``Rescheduled``, ``No-show``, ``Attended``, ``Confirmed``
    :json int session: The session (class) to register for.

    :requestheader Authorization: ``Token <token>``

.. http:put:: /training/(id)/
.. http:patch:: /training/(id)/

    Edit attendance status.

    Same params as POST.

    :requestheader Authorization: ``Token <token>``


Cards
-----

    Cards are sent to Protospace's door controllers to grant access to the
    building. Only active cards of unpaused members are sent.

.. http:get:: /cards/(id)/

    Retrieve a card. Users can only view their own, admins can view anyone's.

    :param id: The card object's ID.

    :requestheader Authorization: ``Token <token>``

    .. sourcecode:: json

        {
            "id": 392,
            "card_number": "text",
            "member_id": 1685,
            "active_status": "card_active",
            "notes": "Tanner Collin",
            "last_seen_at": "2020-01-20",
            "user": 113
        }

.. http:post:: /cards/
.. http:put:: /cards/(id)/
.. http:patch:: /cards/(id)/
.. http:delete:: /cards/(id)/

    Admins only. Don't change the status when pausing a member, paused member's
    cards are filtered out automatically.

    :param id: The card object's ID.

    :json card_number: Usually a 10 character hex string.
    :json int member_id: Which member the card belongs to.
    :json active_status: One of: ``card_blocked``, ``card_inactive``,
        ``card_member_blocked``, ``card_active``
    :json notes: optional

    :requestheader Authorization: ``Token <token>``


Door
----

    Public route that the door controllers should poll for a list of cards
    allowed to scan into the building.

.. http:get:: /door/

    List all active cards of unpaused members.

    The json dict format is to match the current front door controller's script
    and will likely be changed in the future.

    No authentication required.

    **Example response**

    Truncated.

    .. sourcecode:: json

        {
            "0000001234": {
                "name": "Tanner C",
                "id": 1685,
                "enabled": true
            },
            "000000ABCD": {
                "name": "Tanner C",
                "id": 1685,
                "enabled": true
            }
        }

    :json key: The dict keys are the card numbers.
    :json int id: Member's ID.
    :json name: Member's name.
    :json boolean enabled: Always true.

.. http:post:: /door/(card_number)/seen/

    Update card's last_seen_at to today.

    This doesn't do any fancy logging yet.

    :param card_number: Usually a 10 character hex string.

    No authentication required.


Ping
----

.. http:post:: /ping/

    Does nothing except check if a user's auth token is still valid.

    :requestheader Authorization: ``Token <token>``

    **Response**

    :status 200:
