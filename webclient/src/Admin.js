import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Switch, Route, Link, useParams, useHistory } from 'react-router-dom';
import './light.css';
import { Button, Container, Checkbox, Dimmer, Divider, Dropdown, Form, Grid, Header, Icon, Image, Menu, Message, Segment, Table } from 'semantic-ui-react';
import moment from 'moment';
import { apiUrl, statusColor, BasicTable, staticUrl, requester } from './utils.js';
import { NotFound } from './Misc.js';

let historyCache = false;

export function AdminHistory(props) {
	const { token, user } = props;
	const [history, setHistory] = useState(historyCache);
	const [error, setError] = useState(false);

	useEffect(() => {
		requester('/history/', 'GET', token)
		.then(res => {
			setHistory(res.results);
			historyCache = res.results;
		})
		.catch(err => {
			console.log(err);
		});
	}, []);

	return (
		<div>
			{!error ?
				history ?
					<Table basic='very'>
						<Table.Header>
							<Table.Row>
								<Table.HeaderCell>Date</Table.HeaderCell>
								<Table.HeaderCell>Username</Table.HeaderCell>
								<Table.HeaderCell>Type</Table.HeaderCell>
								<Table.HeaderCell>Owner</Table.HeaderCell>
								<Table.HeaderCell>Object</Table.HeaderCell>
								<Table.HeaderCell>Changed Fields</Table.HeaderCell>
							</Table.Row>
						</Table.Header>

						<Table.Body>
							{history.map(x =>
								<Table.Row key={x.id}>
									<Table.Cell>{moment().utc(x.history_date).format('YYYY-MM-DD')}</Table.Cell>
									<Table.Cell>{x.history_user || 'System'}</Table.Cell>
									<Table.Cell>{x.history_type}</Table.Cell>
									<Table.Cell>{x.owner_name}</Table.Cell>
									<Table.Cell>{x.object_name}</Table.Cell>
									<Table.Cell>{x.changes.map(x => x.field).join(', ')}</Table.Cell>
								</Table.Row>
							)}
						</Table.Body>
					</Table>
				:
					<p>Loading...</p>
			:
				<p>Error loading.</p>
			}
		</div>
	);
};

export function Admin(props) {
	return (
		<Container>
			<Header size='large'>Portal Admin</Header>

			<Header size='medium'>Member Data Backup</Header>
			<p>Spaceport backups are created daily. 14 days are kept on the server.</p>
			<p>Backups contain the complete member data and must be kept secure.</p>
			<p>Talk to Tanner to learn how to get backups.</p>

			<Header size='medium'>History (Experimental)</Header>
			<p>Last 100 database changes:</p>

			<AdminHistory {...props} />

		</Container>
	);
};
