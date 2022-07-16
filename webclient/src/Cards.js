import React, { useState } from 'react';
import './light.css';
import moment from 'moment-timezone';
import { Button, Container, Header, Table } from 'semantic-ui-react';
import { BasicTable, staticUrl } from './utils.js';

export function Cards(props) {
	const { user, token } = props;
	const [open, setOpen] = useState(false);

	const cardStatus = (c) => c.active_status === 'card_active' ? 'Yes' : 'No';
	const card = user.cards[0];

	return (
		<Container>
			<Header size='large'>Cards / Access</Header>

			<Header size='medium'>Your Cards</Header>

			{user.member.card_photo ?
				<p>
					<a href={staticUrl + '/' + user.member.card_photo} target='_blank'>
						Click here
					</a> to view your card image.
				</p>
			:
				<p>Upload a photo to generate a card image.</p>
			}

			{user.cards.length ?
				user.cards.length > 1 ?
					<Table basic='very'>
						<Table.Header>
							<Table.Row>
								<Table.HeaderCell>Number</Table.HeaderCell>
								<Table.HeaderCell>Notes</Table.HeaderCell>
								<Table.HeaderCell>Last Scan</Table.HeaderCell>
								<Table.HeaderCell>Active</Table.HeaderCell>
							</Table.Row>
						</Table.Header>

						<Table.Body>
							{user.cards.map(x =>
								<Table.Row key={x.id}>
									<Table.Cell>{x.card_number}</Table.Cell>
									<Table.Cell>{x.notes}</Table.Cell>
									<Table.Cell>
										{x.last_seen ?
											x.last_seen > '2021-11-14T02:01:35.415685Z' ?
												moment.utc(x.last_seen).tz('America/Edmonton').format('lll')
											:
												moment.utc(x.last_seen).tz('America/Edmonton').format('ll')
										:
											'Unknown'
										}
									</Table.Cell>
									<Table.Cell>{cardStatus(x)}</Table.Cell>
								</Table.Row>
							)}
						</Table.Body>
					</Table>
				:
					<BasicTable>
						<Table.Body>
							<Table.Row>
								<Table.Cell>Number:</Table.Cell>
								<Table.Cell>{card.card_number}</Table.Cell>
							</Table.Row>
							<Table.Row>
								<Table.Cell>Notes:</Table.Cell>
								<Table.Cell>{card.notes}</Table.Cell>
							</Table.Row>
							<Table.Row>
								<Table.Cell>Last Seen:</Table.Cell>
								<Table.Cell>
									{card.last_seen ?
										card.last_seen > '2021-11-14T02:01:35.415685Z' ?
											moment.utc(card.last_seen).tz('America/Edmonton').format('lll')
										:
											moment.utc(card.last_seen).tz('America/Edmonton').format('ll')
									:
										'Unknown'
									}
								</Table.Cell>
							</Table.Row>
							<Table.Row>
								<Table.Cell>Active:</Table.Cell>
								<Table.Cell>{cardStatus(card)}</Table.Cell>
							</Table.Row>
						</Table.Body>
					</BasicTable>
			:
				<p>No cards yet! Ask a director for one after you are vetted.</p>
			}

			{!!user.door_code && <React.Fragment>
				<Header size='medium'>Door Alarm Code</Header>

				<p>Only share this with vetted Protospace members:</p>

				<p>{user.door_code}</p>
			</React.Fragment>}

			{!!user.wifi_pass && <React.Fragment>
				<Header size='medium'>Wi-Fi Password</Header>

				<p>Only share this with Protospace members and guests:</p>

				<p>{user.wifi_pass}</p>
			</React.Fragment>}

			<Header size='medium'>API Key</Header>

			<p>Don't share this with anyone! Treat it like your password:</p>

			{open ?
				<React.Fragment>
					<p>{token}</p>

					<Header size='small'>API Docs</Header>

					<p>
						To learn how to use this, refer to the API docs:
						<br />
						<a href='https://docs.my.protospace.ca/api.html' target='_blank' rel='noopener noreferrer' aria-label='link to our API docs'>
							https://docs.my.protospace.ca/api.html
						</a>
					</p>

					<Header size='small'>API Examples</Header>

					<p>Get your user info with Bash (curl):</p>

					<p><code>$ curl -H "Authorization: Token {token}" https://api.my.protospace.ca/user/</code></p>

					<p>Get your user info with Python 3 (and requests):</p>

					<code>
						import json, requests<br/>
						<br />
						SECRET_API_KEY = '{token}'<br />
						<br />
						headers = {'{'}'Authorization': 'Token '+SECRET_API_KEY{'}'}<br />
						r = requests.get('https://api.my.protospace.ca/user/', headers=headers)<br />
						<br />
						print(json.dumps(r.json(), indent=4))<br />
					</code>
				</React.Fragment>
			:
				<p>
					<Button onClick={() => setOpen(true)}>
						Show Secret
					</Button>
				</p>
			}
		</Container>
	);
};

