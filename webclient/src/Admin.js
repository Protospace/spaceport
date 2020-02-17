import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Switch, Route, Link, useParams, useHistory } from 'react-router-dom';
import './light.css';
import { Button, Container, Checkbox, Dimmer, Divider, Dropdown, Form, Grid, Header, Icon, Image, Menu, Message, Segment, Table } from 'semantic-ui-react';
import moment from 'moment';
import { apiUrl, statusColor, BasicTable, staticUrl, requester } from './utils.js';
import { NotFound } from './Misc.js';

export function Admin(props) {
	const { token, user } = props;
	const [backup, setBackup] = useState(false);
	const [reveal, setReveal] = useState(false);
	const [error, setError] = useState(false);

	useEffect(() => {
		requester('/backup/', 'GET', token)
		.then(res => {
			setBackup(res.url);
		})
		.catch(err => {
			console.log(err);
		});
	}, []);

	return (
		<Container>
			<Header size='large'>Portal Admin</Header>

			<Header size='medium'>Backup</Header>
			<p>Spaceport backups are created daily. 14 days are kept on the server.</p>

			{backup ?
				<div>
					<p>
						Download link:<br />
						<a href={backup} target='_blank' rel='noopener noreferrer' aria-label='link to a backup'>
							{backup}
						</a>
					</p>

					Automate with wget (keep secret, that's <b>your</b> login token): <br />
					{reveal ?
						<pre>
							wget \
							<br />  --content-disposition \
							<br />  --header="Authorization: Token {token}" \
							<br />  {apiUrl}/backup/
						</pre>
					:
						<Button onClick={() => setReveal(true)}>Show Secret</Button>
					}
				</div>
			:
				<p>Loading...</p>
			}

		</Container>
	);
};
