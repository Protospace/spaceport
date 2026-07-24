*** Settings ***
Resource   ../resources/Common.resource

*** Keywords ***
Public Messaging Inputs Should Be Visible
    Page Should Contain Text    Send a message to the sign + Vestaboard:
    Page Should Contain Text    Send a message to the Vestaboard only:

Submit Sign And Vestaboard Message
    [Arguments]    ${text}
    Fill Text Safely    input >> nth=7    ${text}
    Click When Ready    text=Submit >> nth=0

Submit Vestaboard Only Message
    [Arguments]    ${text}
    Fill Text Safely    input >> nth=8    ${text}
    Click When Ready    text=Submit >> nth=1
