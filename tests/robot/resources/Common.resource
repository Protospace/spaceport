*** Settings ***
Library    Browser
Library    String
Resource   Variables.resource

*** Keywords ***
Open Spaceport Browser
    New Browser    browser=${BROWSER}    headless=${HEADLESS}
    New Context
    New Page    ${BASE_URL}
    Set Browser Timeout    ${DEFAULT_TIMEOUT}

Close Spaceport Browser
    Close Browser

Go To Home Page
    Go To    ${BASE_URL}
    Wait Until Spaceport Page Ready

Wait Until Spaceport Page Ready
    Wait For Load State    domcontentloaded
    Wait For Elements State    [data-testid="home-stats-section"]    visible

Wait For Url Contains
    [Arguments]    ${partial}
    ${url}=    Get Url
    Should Contain    ${url}    ${partial}

Click When Ready
    [Arguments]    ${selector}
    Wait For Elements State    ${selector}    visible
    Wait For Elements State    ${selector}    enabled
    Click    ${selector}

Fill Text Safely
    [Arguments]    ${selector}    ${value}
    Wait For Elements State    ${selector}    visible
    Fill Text    ${selector}    ${value}

Page Should Contain Text
    [Arguments]    ${text}
    Wait For Elements State    text=${text}    visible

Capture Debug Artifact
    [Arguments]    ${name}=debug
    ${safe_name}=    Replace String Using Regexp    ${name}    [^A-Za-z0-9._-]    _
    Take Screenshot    path=results/${safe_name}.png
