*** Settings ***
Resource   ../resources/Common.resource

*** Keywords ***
Landing Page Should Be Visible
    Wait Until Spaceport Page Ready

Quick Links Should Be Visible
    Page Should Contain Text    Quick Links
    Page Should Contain Text    Main Website
    Page Should Contain Text    Protospace Wiki
    Page Should Contain Text    Forum (Spacebar)

Public Stats Should Be Visible
    Page Should Contain Text    Protospace Stats
    Page Should Contain Text    Member count:
    Page Should Contain Text    Card scans today:
    Page Should Contain Text    Alarm status:
    Page Should Contain Text    Hosting status:
    Page Should Contain Text    Next class:
    Page Should Contain Text    Last class:

Forgot Password Link Should Navigate
    Click When Ready    text=Forgot Password
    Wait For Url Contains    /password/reset/

Guide Link Should Navigate
    Click When Ready    text=Guide
    Wait For Url Contains    /guide/

Charts Link Should Navigate
    Click When Ready    a:has-text("[charts]")
    Wait For Url Contains    /charts

Gallery Requires Login Message Should Be Visible
    Page Should Contain Text    Please login
    Page Should Contain Text    [gallery]

Footer And Support Links Should Be Visible
    Page Should Contain Text    Created and hosted by Protospace members for Protospace members.
    Page Should Contain Text    View the source code and license on GitHub.
    Page Should Contain Text    info@protospace.ca

Unauthorized Operational Statuses Should Be Visible
    Page Should Contain Text    Alarm status: Unauthorized
    Page Should Contain Text    Hosting status: Unauthorized
