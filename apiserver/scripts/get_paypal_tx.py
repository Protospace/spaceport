import sys
import requests
import datetime
import json

if len(sys.argv) < 2:
    print('Pass API key into script. Example: python scripts/get_paypal_tx.py asdf1234')
    exit()
else:
    api_key = sys.argv[1]

transactions = []

end = datetime.datetime.now(datetime.timezone.utc)

while end.year > 2019:
    start = end - datetime.timedelta(days=30)

    start_date = start.isoformat(timespec='seconds').replace('+00:00', '-0000')
    end_date = end.isoformat(timespec='seconds').replace('+00:00', '-0000')

    params = dict(
        start_date=start_date,
        end_date=end_date,
        fields='all',
        page_size=500,
        page=1,
    )
    headers = {
        'Authorization': 'Bearer ' + api_key,
        'Content-Type': 'application/json',
    }

    print('Getting transactions from', start_date, 'to', end_date)

    res = requests.get('https://api-m.paypal.com/v1/reporting/transactions', params=params, headers=headers)
    data = res.json()

    if data['total_pages'] > 1:
        print('Error: More than one page detected.')
        raise

    transactions.extend(data['transaction_details'])
    print('Found', len(data['transaction_details']), 'transactions.')

    end = start

with open('old_paypal.json', 'w') as file:
    json.dump(transactions, file, indent=4)

print('Dumped', len(transactions), 'transactions.')
