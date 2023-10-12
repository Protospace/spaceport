import React, { useState, useEffect, useReducer } from 'react';
import { Link } from 'react-router-dom';
import './light.css';
import { Button, Container, Checkbox, Form, Header, Icon, Table } from 'semantic-ui-react';
import * as Datetime from 'react-datetime';
import moment from 'moment-timezone';
import download from 'downloadjs';
import { apiUrl, statusColor, requester, useIsMobile } from './utils.js';

let vettingCache = false;
let historyCache = false;
let excludeSystemCache = true;
let focusCache = false;


export function AdminVet(props) {
	const { token, member, refreshVetting } = props;
	const [loading, setLoading] = useState(false);
	const [yousure, setYousure] = useState(false);

	const handleVet = (e) => {
		e.preventDefault();

		if (yousure) {
			setLoading(true);
			const data = {vetted_date: moment.utc().tz('America/Edmonton').format('YYYY-MM-DD')}
			requester('/members/' + member.id + '/', 'PATCH', token, data)
			.then(res => {
				refreshVetting();
			})
			.catch(err => {
				console.log(err);
			});
		} else {
			setYousure(true);
		}
	};

	return (
		<Button
			color='green'
			onClick={handleVet}
			loading={loading}
		>
			{yousure ? 'You Sure?' : 'Vet ' + member.preferred_name}
		</Button>
	);
}

export function AdminVetting(props) {
	const { token } = props;
	const [vetting, setVetting] = useState(vettingCache);
	const [refreshCount, refreshVetting] = useReducer(x => x + 1, 0);
	const [error, setError] = useState(false);
	const [showAll, setShowAll] = useState(false);

	useEffect(() => {
		requester('/vetting/', 'GET', token)
		.then(res => {
			setVetting(res.results);
			vettingCache = res.results;
		})
		.catch(err => {
			console.log(err);
			setError(true);
		});
	}, [refreshCount]);

	const displayAll = (vetting && vetting.length <= 5) || showAll;

	return (
		<div className='adminvetting'>
			{!error ?
				vetting ?
					<>
						<Table compact collapsing unstackable basic='very'>
							<Table.Header>
								<Table.Row>
									<Table.HeaderCell>Name</Table.HeaderCell>
									<Table.HeaderCell>Status / NMO</Table.HeaderCell>
									<Table.HeaderCell></Table.HeaderCell>
								</Table.Row>
							</Table.Header>

							<Table.Body>
								{(displayAll ? vetting : vetting.slice(0,5)).sort((a, b) => a.last_name > b.last_name ? 1 : -1).map(x =>
									<Table.Row key={x.id}>
										<Table.Cell><Link to={'/members/'+x.id}>{x.preferred_name} {x.last_name}</Link></Table.Cell>
										<Table.Cell>
											<Icon name='circle' color={statusColor[x.status]} />
											{x.orientation_date ? '✅' : '❌'}
										</Table.Cell>
										<Table.Cell><AdminVet {...props} member={x} refreshVetting={refreshVetting} /></Table.Cell>
									</Table.Row>
								)}
							</Table.Body>
						</Table>

						<p>{displayAll ? '' : '5 / '}{vetting.length} members</p>

						<p>
							{displayAll ?
								<>
									&#8627; <a href={'mailto:'+vetting.map(x => x.email).join(',')}>Email All</a>
								</>
							:
								<Button onClick={() => setShowAll(true)}>Show All</Button>
							}
						</p>
					</>
				:
					<p>Loading...</p>
			:
				<p>Error loading.</p>
			}
		</div>
	);
}

export function AdminHistory(props) {
	const { token, filterMember } = props;
	const [history, setHistory] = useState(historyCache);
	const [excludeSystem, setExcludeSystem] = useState(excludeSystemCache);
	const [focus, setFocus] = useState(focusCache);
	const [error, setError] = useState(false);
	const isMobile = useIsMobile();

	const handleExcludeSystem = (e, v) => {
		setExcludeSystem(v.checked);
		excludeSystemCache = v.checked;
	};

	useEffect(() => {
		let extra = '?exclude_system=' + excludeSystem;
		if (filterMember) {
			extra += '&member_id=' + filterMember;
		}

		requester('/history/'+extra, 'GET', token)
		.then(res => {
			setHistory(res.results);
			historyCache = res.results;
		})
		.catch(err => {
			console.log(err);
			setError(true);
		});
	}, [excludeSystem]);

	return (
		<div>
			{!error ?
				history ?
					<>
						<Header size='medium'>History</Header>
						<p>Last 50 database changes:</p>

						<Checkbox
							label='Exclude System'
							onChange={handleExcludeSystem}
							checked={excludeSystem}
						/>

						<Table basic='very'>
							{!isMobile && <Table.Header>
								<Table.Row>
									<Table.HeaderCell>Date</Table.HeaderCell>
									<Table.HeaderCell>Username</Table.HeaderCell>
									<Table.HeaderCell>Type</Table.HeaderCell>
									{!filterMember && <Table.HeaderCell>Owner</Table.HeaderCell>}
									<Table.HeaderCell>Object</Table.HeaderCell>
									<Table.HeaderCell>Changed Fields</Table.HeaderCell>
								</Table.Row>
							</Table.Header>}

							<Table.Body>
								{!history.length && <p>None</p>}

								{history.map(x =>
									<React.Fragment key={x.id}>
										<Table.Row>
											<Table.Cell>
												<a onClick={() => setFocus(x.id)}>
													{moment.utc(x.history_date).tz('America/Edmonton').format('YYYY-MM-DD')}
												</a>
											</Table.Cell>
											<Table.Cell>{isMobile && 'User: '}{x.is_system ? 'System' : (x.history_user || 'Deleted User')}</Table.Cell>
											<Table.Cell>{isMobile && 'Type: '}{x.history_type}</Table.Cell>
											{!filterMember && <Table.Cell>{isMobile && 'Owner: '}{x.owner_name}</Table.Cell>}
											<Table.Cell>{isMobile && 'Object: '}{x.object_name}</Table.Cell>
											<Table.Cell>{isMobile && 'Changed: '}{x.changes.map(x => x.field).join(', ')}</Table.Cell>
										</Table.Row>

										{focus === x.id &&
											<tr><td colSpan={6}>
												<p>Object ID: {x.object_id}, <a href={apiUrl+x.revert_url} target='_blank'>Database Revert</a></p>
												{!!x.changes.length &&
													<Table basic='very'>
														{!isMobile && <Table.Header>
															<Table.Row>
																<Table.HeaderCell>Change</Table.HeaderCell>
																<Table.HeaderCell>Before</Table.HeaderCell>
																<Table.HeaderCell>After</Table.HeaderCell>
															</Table.Row>
														</Table.Header>}
														<Table.Body>
															{x.changes.map(y =>
																<Table.Row key={y.field}>
																	<Table.Cell>{isMobile && 'Change: '}{y.field}</Table.Cell>
																	<Table.Cell>{isMobile && 'Before: '}{y.old}</Table.Cell>
																	<Table.Cell>{isMobile && 'After: '}{y.new}</Table.Cell>
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
	const isMobile = useIsMobile();

	useEffect(() => {
		requester('/backup/', 'GET')
		.then(res => {
			setBackups(res);
			backupsCache = res;
		})
		.catch(err => {
			console.log(err);
			setError(true);
		});
	}, []);

	return (
		<div>
			{!error ?
				backups ?
					<Table collapsing basic='very'>
						{!isMobile && <Table.Header>
							<Table.Row>
								<Table.HeaderCell>Username</Table.HeaderCell>
								<Table.HeaderCell>Last Downloaded</Table.HeaderCell>
								<Table.HeaderCell>Less than 24 hours ago?</Table.HeaderCell>
							</Table.Row>
						</Table.Header>}

						<Table.Body>
							{backups.filter(x => x.download_time).map(x =>
								<Table.Row key={x.backup_user}>
									<Table.Cell>{isMobile && 'User: '}{x.backup_user}</Table.Cell>
									<Table.Cell>{isMobile && 'Last: '}{moment.utc(x.download_time).tz('America/Edmonton').format('LLLL')}</Table.Cell>
									<Table.Cell>{isMobile && '24h ago: '}{x.less_than_24h ? 'Yes' : 'No - please investigate'}</Table.Cell>
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

export function AdminUsage(props) {
	const { token } = props;
	const [input, setInput] = useState({ month: moment() });
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState(false);

	const handleDatetime = (v) => setInput({ ...input, month: v });

	const handleDownload = (month) => {
		if (loading) return;
		setLoading(true);
		const query = month ? '?month=' + month : '';
		requester('/usage/csv/' + query, 'GET', token)
		.then(res => {
			setLoading(false);
			setError(false);
			return res.blob();
		})
		.then(blob => {
			download(blob, 'usage-'+(month || 'all')+'.csv');
		})
		.catch(err => {
			setLoading(false);
			console.log(err);
			setError(true);
		});
	};


	const handleSubmit = (e) => {
		const month = input.month.format('YYYY-MM');
		handleDownload(month)
	};

	return (
		<div>
			<Form onSubmit={handleSubmit}>
				<label>Month</label>
				<Form.Group>
					<Form.Field>
						<Datetime
							dateFormat='YYYY-MM'
							timeFormat={false}
							value={input.month}
							onChange={handleDatetime}
						/>
					</Form.Field>

					<Form.Button loading={loading}>
						Download
					</Form.Button>
				</Form.Group>
			</Form>

			<Form.Button loading={loading} onClick={() => handleDownload(null)}>
				Download All
			</Form.Button>

			{error && <p>Error.</p>}
		</div>
	);
};

export function Admin(props) {
	return (
		<Container>
			<Header size='large'>Portal Admin</Header>

			<Header size='medium'>Ready to Vet</Header>
			<p>Members who are Current or Due, and past their probationary period.</p>
			<p>Sorted by last name.</p>
			<AdminVetting {...props} />


			<Header size='medium'>Member Data Backup</Header>
			<p>Spaceport backups are created daily. 14 days are kept on the server.</p>

			<Header size='small'>Backup Downloads</Header>
			<AdminBackups />


			<Header size='medium'>Trotec Device Usage</Header>
			<p>All times are in Mountain time.</p>
			<AdminUsage {...props} />

			<p/>

			<AdminHistory {...props} />

		</Container>
	);
};
