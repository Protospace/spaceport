import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Switch, Route, Link, useParams, useHistory } from 'react-router-dom';
import './light.css';
import { Button, Container, Checkbox, Dimmer, Divider, Dropdown, Form, Grid, Header, Icon, Image, Menu, Message, Segment, Table } from 'semantic-ui-react';
import moment from 'moment-timezone';
import { statusColor, BasicTable, staticUrl, requester } from './utils.js';
import { TrainingList } from './Training.js';
import { NotFound } from './Misc.js';

function AdminCardDetail(props) {
	const { token, result, card } = props;
	const [input, setInput] = useState({ ...card });
	const [error, setError] = useState(false);
	const [loading, setLoading] = useState(false);
	const [success, setSuccess] = useState(false);
	const [yousure, setYousure] = useState(false);
	const id = card.id;

	const handleValues = (e, v) => setInput({ ...input, [v.name]: v.value });
	const handleUpload = (e, v) => setInput({ ...input, [v.name]: e.target.files[0] });
	const handleChange = (e) => handleValues(e, e.currentTarget);
	const handleCheck = (e, v) => setInput({ ...input, [v.name]: v.checked });

	const handleSubmit = (e) => {
		if (loading) return;
		setLoading(true);
		setSuccess(false);
		const data = { ...input, member_id: result.member.id };
		requester('/cards/'+id+'/', 'PUT', token, data)
		.then(res => {
			setLoading(false);
			setSuccess(true);
			setError(false);
			setInput(res);
		})
		.catch(err => {
			setLoading(false);
			console.log(err);
			setError(err.data);
		});
	};

	const handleDelete = (e) => {
		e.preventDefault();

		if (yousure) {
			requester('/cards/'+id+'/', 'DELETE', token)
			.then(res => {
				setInput(false);
			})
			.catch(err => {
				console.log(err);
			});
		} else {
			setYousure(true);
		}
	};

	const makeProps = (name) => ({
		name: name,
		onChange: handleChange,
		value: input[name] || '',
		error: error[name],
	});

	const statusOptions = [
		{ key: '0', text: 'Card Active', value: 'card_active' },
		{ key: '1', text: 'Card Blocked', value: 'card_blocked' },
		{ key: '2', text: 'Card Inactive', value: 'card_inactive' },
		{ key: '3', text: 'Card Member Blocked', value: 'card_member_blocked' },
	];

	return (
		input ?
			<Segment raised color={input.active_status === 'card_active' ? 'green' : 'red'}>
				<Form onSubmit={handleSubmit}>
					<Form.Group widths='equal'>
						<Form.Input
							fluid
							{...makeProps('card_number')}
						/>
						<Form.Select
							fluid
							options={statusOptions}
							{...makeProps('active_status')}
							onChange={handleValues}
						/>

						<Form.Group widths='equal'>
							<Form.Button
								loading={loading}
								error={error.non_field_errors}
							>
								{success ? 'Saved.' : 'Save'}
							</Form.Button>

							<Form.Button
								color='red'
								onClick={handleDelete}
							>
								{yousure ? 'You Sure?' : 'Delete'}
							</Form.Button>
						</Form.Group>
					</Form.Group>

					Notes: {input.notes || 'None'}<br />
					Last Seen:{' '}
					{input.last_seen ?
						input.last_seen > '2021-11-14T02:01:35.415685Z' ?
							moment.utc(input.last_seen).tz('America/Edmonton').format('lll')
						:
							moment.utc(input.last_seen).tz('America/Edmonton').format('ll')
					:
						'Unknown'
					}
				</Form>
			</Segment>
		:
			<Segment raised color='black'>
				Deleted card: {card.card_number}
			</Segment>
	);
};

let prevAutoscan = '';

export function AdminMemberCards(props) {
	const { token, result, refreshResult } = props;
	const cards = result.cards;
	const startDimmed = Boolean((result.member.paused_date || !result.member.is_allowed_entry) && cards.length);
	const [dimmed, setDimmed] = useState(startDimmed);
	const [input, setInput] = useState({ active_status: 'card_active' });
	const [error, setError] = useState(false);
	const [loading, setLoading] = useState(false);
	const [success, setSuccess] = useState(false);
	const [cardPhoto, setCardPhoto] = useState(false);
	const { id } = useParams();

	useEffect(() => {
		const startDimmed = Boolean((result.member.paused_date || !result.member.is_allowed_entry) && cards.length);
		setDimmed(startDimmed);
	}, [result.member]);

	const handleValues = (e, v) => setInput({ ...input, [v.name]: v.value });
	const handleUpload = (e, v) => setInput({ ...input, [v.name]: e.target.files[0] });
	const handleChange = (e) => handleValues(e, e.currentTarget);
	const handleCheck = (e, v) => setInput({ ...input, [v.name]: v.checked });

	const handleSubmit = (e) => {
		if (loading) return;
		setLoading(true);
		setSuccess(false);
		const data = { ...input, member_id: result.member.id };
		requester('/cards/', 'POST', token, data)
		.then(res => {
			setLoading(false);
			setSuccess(true);
			setError(false);
			refreshResult();
		})
		.catch(err => {
			setLoading(false);
			console.log(err);
			setError(err.data);
		});
	};

	const getAutoscan = () => {
		return requester('/stats/', 'GET', token)
		.then(res => {
			return res?.autoscan;
		})
		.catch(err => {
			console.log(err);
		});
	};

	const checkAutoscan = () => {
		getAutoscan().then(newScan => {
			if (newScan != prevAutoscan) {
				prevAutoscan = newScan;
				setInput({ ...input, card_number: newScan });
			}
		});
	};

	useEffect(() => {
		if (cardPhoto) {
			getAutoscan().then(scan => {
				prevAutoscan = scan;
			});
			const interval = setInterval(checkAutoscan, 1000);
			return () => clearInterval(interval);
		}
	}, [cardPhoto]);

	const getCardPhoto = (e) => {
		e.preventDefault();
		requester('/members/' + id + '/card_photo/', 'GET', token)
		.then(res => res.blob())
		.then(res => {
			setCardPhoto(URL.createObjectURL(res));
		})
		.catch(err => {
			console.log(err);
		});
	};

	const makeProps = (name) => ({
		name: name,
		onChange: handleChange,
		value: input[name] || '',
		error: error[name],
	});

	const statusOptions = [
		{ key: '0', text: 'Card Active', value: 'card_active' },
		{ key: '1', text: 'Card Blocked', value: 'card_blocked' },
		{ key: '2', text: 'Card Inactive', value: 'card_inactive' },
		{ key: '3', text: 'Card Member Blocked', value: 'card_member_blocked' },
	];

	return (
		<div>
			<Header size='medium'>Edit Member Cards</Header>

			{result.member.photo_large ?
				<p>
					<Button onClick={(e) => getCardPhoto(e)}>Add a Card</Button>
				</p>
			:
				<p>No card image, member photo missing!</p>
			}

			{cardPhoto &&
				<Form onSubmit={handleSubmit}>
					<p>
						<Image rounded size='medium' src={cardPhoto} />
					</p>

					<Header size='small'>How to Print a Card</Header>
					<ol>
						<li>Right click on image > Save image as...</li>
						<li>Right click on file > Print</li>
						<li>Select Datacard Printer, Print</li>
						<li>Plug card scanner in</li>
						<li>Open "RfidReader" on desktop</li>
						<li>Scan card, add the number</li>
						<li><b>Have them test their card</b></li>
					</ol>

					<Form.Group widths='equal'>
						<Form.Input
							label='Card Number (Listening...)'
							fluid
							{...makeProps('card_number')}
						/>
						<Form.Select
							label='Card Status'
							options={statusOptions}
							fluid
							{...makeProps('active_status')}
							onChange={handleValues}
						/>
						<Form.Input
							label='Optional Note'
							fluid
							{...makeProps('notes')}
						/>
					</Form.Group>

					<Form.Checkbox
						label='Confirmed that the member has been given a tour and knows the alarm code'
						required
						{...makeProps('given_tour')}
						onChange={handleCheck}
						checked={input.given_tour}
					/>

					<Form.Button disabled={!input.given_tour} loading={loading} error={error.non_field_errors}>
						Submit
					</Form.Button>
					{success && <div>Success!</div>}
				</Form>
			}

			<Header size='small'>Current Cards</Header>

			<Dimmer.Dimmable dimmed={dimmed}>
				{cards.length ?
					cards.map(x =>
						<AdminCardDetail key={x.id} card={x} {...props} />
					)
				:
					<p>None</p>
				}

				<Dimmer active={dimmed}>
					<p>
						Member paused or not allowed entry, {cards.length} card{cards.length === 1 ? '' : 's'} ignored anyway.
					</p>
					<p>
						<Button size='tiny' onClick={() => setDimmed(false)}>Close</Button>
					</p>
				</Dimmer>
			</Dimmer.Dimmable>

		</div>
	);
};

export function AdminMemberPause(props) {
	const { token, result, refreshResult } = props;
	const [error, setError] = useState(false);
	const [loading, setLoading] = useState(false);
	const [success, setSuccess] = useState(false);
	const [told, setTold] = useState(false);
	const { id } = useParams();

	useEffect(() => {
		setLoading(false);
	}, [result.member]);

	const handlePause = (e) => {
		if (loading) return;
		setLoading(true);
		setSuccess(false);
		requester('/members/' + id + '/pause/', 'POST', token, {})
		.then(res => {
			setSuccess(true);
			setError(false);
			refreshResult();
		})
		.catch(err => {
			setLoading(false);
			console.log(err);
			setError(true);
		});
	};

	const handleUnpause = (e) => {
		if (loading) return;
		setLoading(true);
		setSuccess(false);
		requester('/members/' + id + '/unpause/', 'POST', token, {})
		.then(res => {
			setSuccess(true);
			setError(false);
			refreshResult();
		})
		.catch(err => {
			setLoading(false);
			console.log(err);
			setError(true);
		});
	};

	return (
		<div>
			<Header size='medium'>Pause / Unpause Membership</Header>

			<p>Pause members who are inactive, former, or on vacation.</p>

			<p>
				{result.member.paused_date ?
					<Button onClick={handleUnpause} loading={loading}>
						Unpause
					</Button>
				:
					<>
						<p>
							<Form.Checkbox
								name='told_subscriptions'
								value={told}
								label='Told member to stop any PayPal subscriptions'
								required
								onChange={(e, v) => setTold(v.checked)}
							/>
						</p>

						<Button onClick={handlePause} loading={loading} disabled={!told}>
							Pause
						</Button>
					</>
				}
			</p>

			{success && <div>Success!</div>}
			{error && <p>Error, something went wrong.</p>}
		</div>
	);
};

export function AdminMemberForm(props) {
	const { token, result, refreshResult } = props;
	const [input, setInput] = useState(result.member);
	const [error, setError] = useState(false);
	const [loading, setLoading] = useState(false);
	const [success, setSuccess] = useState(false);
	const { id } = useParams();

	useEffect(() => {
		setInput(result.member);
	}, [result.member]);

	const handleValues = (e, v) => setInput({ ...input, [v.name]: v.value });
	const handleUpload = (e, v) => setInput({ ...input, [v.name]: e.target.files[0] });
	const handleChange = (e) => handleValues(e, e.currentTarget);
	const handleCheck = (e, v) => setInput({ ...input, [v.name]: v.checked });

	const handleSubmit = (e) => {
		if (loading) return;
		setLoading(true);
		setSuccess(false);
		const data = { ...input, email: input.email.toLowerCase() };
		requester('/members/' + id + '/', 'PATCH', token, data)
		.then(res => {
			setLoading(false);
			setSuccess(true);
			setError(false);
			refreshResult();
		})
		.catch(err => {
			setLoading(false);
			console.log(err);
			setError(err.data);
		});
	};

	const makeProps = (name) => ({
		name: name,
		onChange: handleChange,
		value: input[name] || '',
		error: error[name],
	});

	return (
		<div>
			<Form onSubmit={handleSubmit}>
				<Header size='medium'>Edit Member Details</Header>

				<Form.Group widths='equal'>
					<Form.Input
						label='First Name'
						fluid
						{...makeProps('first_name')}
					/>
					<Form.Input
						label='Last Name'
						fluid
						{...makeProps('last_name')}
					/>
				</Form.Group>

				<Form.Input
					label='Preferred Name'
					{...makeProps('preferred_name')}
				/>

				<Form.Input
					label='Email'
					{...makeProps('email')}
				/>

				<Form.Input
					label='Current Start Date'
					{...makeProps('current_start_date')}
				/>

				<Form.Input
					label='Vetted Date'
					{...makeProps('vetted_date')}
				/>

				<Form.Input
					label='Membership Fee'
					{...makeProps('monthly_fees')}
				/>

				<Form.Field>
					<label>Is the member an instructor?</label>
					<Checkbox
						label='Yes'
						name='is_instructor'
						onChange={handleCheck}
						checked={input.is_instructor}
					/>
				</Form.Field>

				<Form.Field>
					<label>Is the member allowed entry?</label>
					<Checkbox
						label='Yes'
						name='is_allowed_entry'
						onChange={handleCheck}
						checked={input.is_allowed_entry}
					/>
				</Form.Field>

				<Form.TextArea
					label={'Private Notes (shared with ' + input.preferred_name + ')'}
					{...makeProps('private_notes')}
				/>

				<Form.Button loading={loading} error={error.non_field_errors}>
					Submit
				</Form.Button>
				{success && <div>Success!</div>}
			</Form>
		</div>
	);
};

export function AdminMemberInfo(props) {
	const member = props.result.member;

	return (
		<div>
			<Header size='medium'>Admin Details</Header>

			<BasicTable>
				<Table.Body>
					<Table.Row>
						<Table.Cell>Name:</Table.Cell>
						<Table.Cell>{member.first_name} {member.last_name}</Table.Cell>
					</Table.Row>
					<Table.Row>
						<Table.Cell>Status:</Table.Cell>
						<Table.Cell>
							<Icon name='circle' color={statusColor[member.status]} />
							{member.status || 'Unknown'}
						</Table.Cell>
					</Table.Row>

					<Table.Row>
						<Table.Cell>Application Date:</Table.Cell>
						<Table.Cell>{member.application_date}</Table.Cell>
					</Table.Row>

					<Table.Row>
						<Table.Cell>Expire Date:</Table.Cell>
						<Table.Cell>{member.expire_date}</Table.Cell>
					</Table.Row>

					{member.paused_date && <Table.Row>
						<Table.Cell>Paused Date:</Table.Cell>
						<Table.Cell>{member.paused_date}</Table.Cell>
					</Table.Row>}

					<Table.Row>
						<Table.Cell>Phone:</Table.Cell>
						<Table.Cell>{member.phone}</Table.Cell>
					</Table.Row>

					<Table.Row>
						<Table.Cell>Emergency Contact Name:</Table.Cell>
						<Table.Cell>{member.emergency_contact_name || 'None'}</Table.Cell>
					</Table.Row>
					<Table.Row>
						<Table.Cell>Emergency Contact Phone:</Table.Cell>
						<Table.Cell>{member.emergency_contact_phone || 'None'}</Table.Cell>
					</Table.Row>

					<Table.Row>
						<Table.Cell>Discourse Username:</Table.Cell>
						<Table.Cell>
							{member.discourse_username ?
								<a href={'https://forum.protospace.ca/u/' + member.discourse_username + '/summary'} target='_blank'>
									{member.discourse_username}
								</a>
							:
								'None'
							}
						</Table.Cell>
					</Table.Row>

					<Table.Row>
						<Table.Cell>Public Bio:</Table.Cell>
					</Table.Row>
				</Table.Body>
			</BasicTable>

			<p className='bio-paragraph'>
				{member.public_bio || 'None yet.'}
			</p>

			{member.member_forms && <p>
				<a href={staticUrl + '/' + member.member_forms} target='_blank'>
					View application forms
				</a>
			</p>}
		</div>
	);
};

export function AdminMemberTraining(props) {
	const training = props.result.training;

	return (
		<div>
			<Header size='medium'>Member Training</Header>

			{training.length ?
				<TrainingList training={training} />
			:
				<p>None</p>
			}

		</div>
	);
};

export function AdminCert(props) {
	const { token, result, name, field, refreshResult } = props;
	const member = result.member;
	const [loading, setLoading] = useState(false);

	const handleCert = (e) => {
		e.preventDefault();
		if (loading) return;
		setLoading(true);
		let data = Object();
		data[field] = moment.utc().tz('America/Edmonton').format('YYYY-MM-DD');
		requester('/members/' + member.id + '/', 'PATCH', token, data)
		.then(res => {
			refreshResult();
		})
		.catch(err => {
			console.log(err);
		});
	};

	const handleUncert = (e) => {
		e.preventDefault();
		if (loading) return;
		setLoading(true);
		let data = Object();
		data[field] = null;
		requester('/members/' + member.id + '/', 'PATCH', token, data)
		.then(res => {
			refreshResult();
		})
		.catch(err => {
			console.log(err);
		});
	};

	useEffect(() => {
		setLoading(false);
	}, [member[field]]);

	return (
		member[field] ?
			<Button
				onClick={handleUncert}
				loading={loading}
			>
				Uncertify
			</Button>
		:
			<Button
				color='green'
				onClick={handleCert}
				loading={loading}
			>
				Certify {name}
			</Button>
	);
}

export function AdminMemberCertifications(props) {
	const member = props.result.member;

	return (
		<div>
			<Header size='medium'>Member Certifications</Header>

			<p>These certifications control access to the lockouts.</p>

			<Table basic='very'>
				<Table.Header>
					<Table.Row>
						<Table.HeaderCell>Name</Table.HeaderCell>
						<Table.HeaderCell>Certification</Table.HeaderCell>
						<Table.HeaderCell>Course</Table.HeaderCell>
						<Table.HeaderCell></Table.HeaderCell>
					</Table.Row>
				</Table.Header>

				<Table.Body>
					<Table.Row>
						<Table.Cell>Common</Table.Cell>
						<Table.Cell>{member.vetted_date || member.orientation_date ? 'Yes' : 'No'}</Table.Cell>
						<Table.Cell><Link to='/courses/249'>New Members: Orientation and Basic Safety</Link></Table.Cell>
						<Table.Cell><AdminCert name='Common' field='orientation_date' {...props} /></Table.Cell>
					</Table.Row>
					<Table.Row>
						<Table.Cell>Wood 1</Table.Cell>
						<Table.Cell>{member.wood_cert_date ? 'Yes, ' + member.wood_cert_date : 'No'}</Table.Cell>
						<Table.Cell><Link to='/courses/261'>Woodworking Tools 1: Intro to Saws</Link></Table.Cell>
						<Table.Cell><AdminCert name='Wood 1' field='wood_cert_date' {...props} /></Table.Cell>
					</Table.Row>
					<Table.Row>
						<Table.Cell>Wood 2</Table.Cell>
						<Table.Cell>{member.wood2_cert_date ? 'Yes, ' + member.wood2_cert_date : 'No'}</Table.Cell>
						<Table.Cell><Link to='/courses/401'>Woodworking Tools 2: Jointer, Thickness Planer, Drum Sander</Link></Table.Cell>
						<Table.Cell><AdminCert name='Wood 2' field='wood2_cert_date' {...props} /></Table.Cell>
					</Table.Row>
					<Table.Row>
						<Table.Cell>Lathe</Table.Cell>
						<Table.Cell>{member.lathe_cert_date ? 'Yes, ' + member.lathe_cert_date : 'No'}</Table.Cell>
						<Table.Cell><Link to='/courses/281'>Metal: Metal Cutting & Manual Lathe</Link></Table.Cell>
						<Table.Cell><AdminCert name='Lathe' field='lathe_cert_date' {...props} /></Table.Cell>
					</Table.Row>
					<Table.Row>
						<Table.Cell>Mill</Table.Cell>
						<Table.Cell>{member.mill_cert_date ? 'Yes, ' + member.mill_cert_date : 'No'}</Table.Cell>
						<Table.Cell><Link to='/courses/283'>Metal: Manual Mill & Advanced Lathe</Link></Table.Cell>
						<Table.Cell><AdminCert name='Mill' field='mill_cert_date' {...props} /></Table.Cell>
					</Table.Row>
					<Table.Row>
						<Table.Cell>Tormach CNC</Table.Cell>
						<Table.Cell>{member.tormach_cnc_cert_date ? 'Yes, ' + member.tormach_cnc_cert_date : 'No'}</Table.Cell>
						<Table.Cell><Link to='/courses/259'>Tormach: CAM and Tormach Intro</Link></Table.Cell>
						<Table.Cell><AdminCert name='Tormach CNC' field='tormach_cnc_cert_date' {...props} /></Table.Cell>
					</Table.Row>
					<Table.Row>
						<Table.Cell>Precix CNC</Table.Cell>
						<Table.Cell>{member.precix_cnc_cert_date ? 'Yes, ' + member.precix_cnc_cert_date : 'No'}</Table.Cell>
						<Table.Cell><Link to='/courses/428'>Basic CNC Wood Router</Link></Table.Cell>
						<Table.Cell><AdminCert name='Precix CNC' field='precix_cnc_cert_date' {...props} /></Table.Cell>
					</Table.Row>
					<Table.Row>
						<Table.Cell>Rabbit Laser</Table.Cell>
						<Table.Cell>{member.rabbit_cert_date ? 'Yes, ' + member.rabbit_cert_date : 'No'}</Table.Cell>
						<Table.Cell><Link to='/courses/247'>Laser: Cutting and Engraving</Link></Table.Cell>
						<Table.Cell><AdminCert name='Rabbit' field='rabbit_cert_date' {...props} /></Table.Cell>
					</Table.Row>
					<Table.Row>
						<Table.Cell>Trotec Laser</Table.Cell>
						<Table.Cell>{member.trotec_cert_date ? 'Yes, ' + member.trotec_cert_date : 'No'}</Table.Cell>
						<Table.Cell><Link to='/courses/321'>Laser: Trotec Course</Link></Table.Cell>
						<Table.Cell><AdminCert name='Trotec' field='trotec_cert_date' {...props} /></Table.Cell>
					</Table.Row>
				</Table.Body>
			</Table>

		</div>
	);
};
