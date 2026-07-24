*** Settings ***
Resource   ../resources/Common.resource

*** Keywords ***
Public Messaging Inputs Should Be Visible
    Page Should Contain Text    Send a message to the sign + Vestaboard:
    Page Should Contain Text    Send a message to the Vestaboard only:

Submit Sign And Vestaboard Message
    [Arguments]    ${text}
    Fill Text Safely    [data-testid="sign-and-vestaboard-input"]    ${text}
    Click When Ready    [data-testid="sign-and-vestaboard-submit"]

Submit Vestaboard Only Message
    [Arguments]    ${text}
    Fill Text Safely    [data-testid="vestaboard-only-input"]    ${text}
    Click When Ready    [data-testid="vestaboard-only-submit"]
