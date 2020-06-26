import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Switch, Route, Link, useParams, useHistory } from 'react-router-dom';
import './light.css';
import { Button, Container, Checkbox, Dimmer, Divider, Dropdown, Form, Grid, Header, Icon, Image, Menu, Message, Segment, Table } from 'semantic-ui-react';
import moment from 'moment-timezone';
import { apiUrl, statusColor, BasicTable, staticUrl, requester } from './utils.js';
import { NotFound } from './Misc.js';

let historyCache = false;
let excludeSystemCache = true;
let focusCache = false;

export function AdminHistory(props) {
	const { token, user } = props;
	const [history, setHistory] = useState(historyCache);
	const [excludeSystem, setExcludeSystem] = useState(excludeSystemCache);
	const [focus, setFocus] = useState(focusCache);
	const [error, setError] = useState(false);

	const handleExcludeSystem = (e, v) => {
		setExcludeSystem(v.checked);
		excludeSystemCache = v.checked;
	};

	useEffect(() => {
		const extra = excludeSystem ? '?exclude_system' : '';
		requester('/history/'+extra, 'GET', token)
		.then(res => {
			setHistory(res.results);
			historyCache = res.results;
		})
		.catch(err => {
			console.log(err);
		});
	}, [excludeSystem]);

	return (
		<div>
			{!error ?
				history ?
					<>
						<Checkbox
							label='Exclude System'
							onChange={handleExcludeSystem}
							checked={excludeSystem}
						/>

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
									<React.Fragment key={x.id}>
										<Table.Row>
											<Table.Cell>
												<a href='javascript:;' onClick={() => setFocus(x.id)}>
													{moment.utc(x.history_date).tz('America/Edmonton').format('YYYY-MM-DD')}
												</a>
											</Table.Cell>
											<Table.Cell>{x.is_system ? 'System' : (x.history_user || 'Deleted User')}</Table.Cell>
											<Table.Cell>{x.history_type}</Table.Cell>
											<Table.Cell>{x.owner_name}</Table.Cell>
											<Table.Cell>{x.object_name}</Table.Cell>
											<Table.Cell>{x.changes.map(x => x.field).join(', ')}</Table.Cell>
										</Table.Row>

										{focus == x.id &&
											<tr><td colSpan={6}>
												<p>Object ID: {x.object_id}, <a href={apiUrl+x.revert_url} target='_blank'>Database Revert</a></p>
												{!!x.changes.length &&
													<Table basic='very'>
														<Table.Header>
															<Table.Row>
																<Table.HeaderCell>Change</Table.HeaderCell>
																<Table.HeaderCell>Before</Table.HeaderCell>
																<Table.HeaderCell>After</Table.HeaderCell>
															</Table.Row>
														</Table.Header>
														<Table.Body>
															{x.changes.map(y =>
																<Table.Row key={y.field}>
																	<Table.Cell>{y.field}</Table.Cell>
																	<Table.Cell>{y.old}</Table.Cell>
																	<Table.Cell>{y.new}</Table.Cell>
																</Table.Row>
															)}
														</Table.Body>
													</Table>
												}
											</td></tr>
										}
									</React.Fragment>
								)}
							</Table.Body>
						</Table>
					</>
				:
					<p>Loading...</p>
			:
				<p>Error loading.</p>
			}
		</div>
	);
};

let backupsCache = false;

export function AdminBackups(props) {
	const [backups, setBackups] = useState(backupsCache);
	const [error, setError] = useState(false);

	useEffect(() => {
		requester('/backup/', 'GET')
		.then(res => {
			setBackups(res);
			backupsCache = res;
		})
		.catch(err => {
			console.log(err);
		});
	}, []);

	return (
		<div>
			{!error ?
				backups ?
					<Table collapsing basic='very'>
						<Table.Header>
							<Table.Row>
								<Table.HeaderCell>Username</Table.HeaderCell>
								<Table.HeaderCell>Last Downloaded</Table.HeaderCell>
								<Table.HeaderCell>Less than 24 hours ago?</Table.HeaderCell>
							</Table.Row>
						</Table.Header>

						<Table.Body>
							{backups.filter(x => x.download_time).map(x =>
								<Table.Row key={x.backup_user}>
									<Table.Cell>{x.backup_user}</Table.Cell>
									<Table.Cell>{moment.utc(x.download_time).tz('America/Edmonton').format('LLLL')}</Table.Cell>
									<Table.Cell>{x.less_than_24h ? 'Yes' : 'No - please investigate'}</Table.Cell>
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

			<Header size='small'>Backup Downloads</Header>
			<AdminBackups />

			<Header size='medium'>History</Header>
			<p>Last 50 database changes:</p>

			<AdminHistory {...props} />

		</Container>
	);
};
