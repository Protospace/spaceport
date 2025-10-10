# Printer Billing Integration

This is how the [Large Format Printer](https://wiki.protospace.ca/Printer,_44%22_Large_Format_(HP_DesignJet_T1200),_ID:166)'s billing system works.

## Theory

The printer is configured to email print accounting reports to a dummy email address. The SMTP email server is actually a python script that interprets the email and sends the accounting info to the portal.

Windows should send the currently logged on user's name to the printer via the print driver. Sometimes this doesn't happen, so data from the [Logon Tracker Integration](Logon%20Tracker%20Integration.md) is used.

## Setup

### Printer Reporting

Open printer's web config, ie. http://172.17.18.153

Setup > Printer settings:
- Send accounting files: Enabled
- Send accounting files to: spaceport@example.com
- Send accounting files every: 1 prints
- Exclude personal information from accounting e-mail: Off
- Hit Apply

Go to Email server page:
- SMTP server: 172.17.17.181
- Printer e-mail address: printer@example.com
- Hit Apply

AutoSend can remain disabled.

![](Pasted%20image%2020250115063417.png)

![](Pasted%20image%2020250115063429.png)

The SMTP server 172.17.17.181 needs to point to the server running the python script (probably Tanner's "dev server", hosted on Proxmox).

### Python Script

Python script can be found here:

https://github.com/Protospace/telemetry/tree/master/printer_report

The script parses the printer's email and sends the data to the portal.

### Portal

Configure `PRINTER_API_TOKEN` in [secrets.py](https://github.com/Protospace/spaceport/blob/master/apiserver/apiserver/secrets.py.example) and copy it to the python script's secrets.py.

The function `printer_report(...)` in [views.py](https://github.com/Protospace/spaceport/blob/master/apiserver/apiserver/api/views.py) is where the data is processed into a transaction that deducts from a user's Protocoin balance.

Material costs are configured in the `PAPER_COSTS` dictionary. To add a new type of paper, find the exact name the printer sends by reading the log files.

### Protocoin Balance Display

The Arduino code for this is here:

https://github.com/Protospace/telemetry/blob/master/printer_balance/printer_balance.ino

It polls the portal's `/protocoin/printer_balance/` API route handled by `printer_balance(...)` in [views.py](https://github.com/Protospace/spaceport/blob/master/apiserver/apiserver/api/views.py). The computer's name must match what gets sent by the [Logon Tracker Integration](Logon%20Tracker%20Integration.md) (currently "ARTEMUS"). The balance gets displayed when the computer is logged in.