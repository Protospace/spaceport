*** Settings ***
Resource    ../pages/LandingPage.resource
Resource    ../pages/PublicMessagingPage.resource
Resource    ../resources/Common.resource
Suite Setup    Open Spaceport Browser
Suite Teardown    Close Spaceport Browser
Test Tags    smoke    public    stable
Test Teardown    Run Keyword If Test Failed    Capture Debug Artifact    ${TEST NAME}

*** Test Cases ***
Public Landing Page Renders Core Sections
    Go To Home Page
    Landing Page Should Be Visible
    Quick Links Should Be Visible
    Public Stats Should Be Visible
    Unauthorized Operational Statuses Should Be Visible
    Footer And Support Links Should Be Visible
    Gallery Requires Login Message Should Be Visible

Public Messaging Areas Render
    Go To Home Page
    Landing Page Should Be Visible
    Public Messaging Inputs Should Be Visible

Forgot Password Link Navigates
    Go To Home Page
    Landing Page Should Be Visible
    Forgot Password Link Should Navigate

Guide Link Navigates
    Go To Home Page
    Landing Page Should Be Visible
    Guide Link Should Navigate

Protected Cards Page Requires Login
    Go To    ${BASE_URL}/cards
    Page Should Contain Text    You must login before you can do that!
    Page Should Contain Text    Visit our login page, then try again.
