import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Switch, Route, Link, useParams, useHistory } from 'react-router-dom';
import './light.css';
import { Button, Container, Checkbox, Dimmer, Divider, Dropdown, Form, Grid, Header, Icon, Image, Menu, Message, Segment, Table } from 'semantic-ui-react';
import moment from 'moment';
import { statusColor, BasicTable, staticUrl, requester } from './utils.js';
import { TransactionList, TransactionEditor } from './Transactions.js';

export function AdminTransactions(props) {
	const { token, result, refreshResult } = props;
	const transactions = result.transactions;
	const [open, setOpen] = useState(false);
	const [input, setInput] = useState({ date: moment().format('YYYY-MM-DD'), info_source: 'Web' });
	const [error, setError] = useState(false);
	const [loading, setLoading] = useState(false);
	const [success, setSuccess] = useState(false);
	const { id } = useParams();

	const handleSubmit = (e) => {
		setLoading(true);
		setSuccess(false);
		const data = { ...input, member_id: id };
		requester('/transactions/', 'POST', token, data)
		.then(res => {
			setSuccess(res.id);
			setInput({});
			setLoading(false);
			setError(false);
			refreshResult();
		})
		.catch(err => {
			setLoading(false);
			console.log(err);
			setError(err.data);
		});
	};

	return (
		<div>
			<Header size='medium'>Edit Member Transactions</Header>

			<Form onSubmit={handleSubmit}>
				<Header size='small'>Add a Transaction</Header>

				<TransactionEditor input={input} setInput={setInput} error={error} />

				{success && <p>Added! <Link to={'/transactions/'+success}>View the transaction.</Link></p>}
				<Form.Button loading={loading} error={error.non_field_errors}>
					Submit
				</Form.Button>
			</Form>

			<Header size='small'>Current Transactions</Header>

			{transactions.length ?
				open ?
					<TransactionList transactions={transactions} />
				:
					<Button onClick={() => setOpen(true)}>
						View / Edit Transactions
					</Button>
			:
				<p>None</p>
			}

		</div>
	);
};

function AdminCardDetail(props) {
	const { token, result, card } = props;
	const [input, setInput] = useState({ ...card });
	const [error, setError] = useState(false);
	const [loading, setLoading] = useState(false);
	const [success, setSuccess] = useState(false);
	const id = card.id;

	const handleValues = (e, v) => setInput({ ...input, [v.name]: v.value });
	const handleUpload = (e, v) => setInput({ ...input, [v.name]: e.target.files[0] });
	const handleChange = (e) => handleValues(e, e.currentTarget);
	const handleCheck = (e, v) => setInput({ ...input, [v.name]: v.checked });

	const handleSubmit = (e) => {
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

		requester('/cards/'+id+'/', 'DELETE', token)
		.then(res => {
			setInput(false);
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
								Delete
							</Form.Button>
						</Form.Group>
					</Form.Group>

					Notes: {input.notes || 'None'}
				</Form>
			</Segment>
		:
			<Segment raised color='black'>
				Deleted card: {card.card_number}
			</Segment>
	);
};

export function AdminMemberCards(props) {
	const { token, result, refreshResult } = props;
	const cards = result.cards;
	const startDimmed = Boolean(result.member.paused_date && cards.length);
	const [dimmed, setDimmed] = useState(startDimmed);
	const [input, setInput] = useState({ active_status: 'card_active' });
	const [error, setError] = useState(false);
	const [loading, setLoading] = useState(false);
	const [success, setSuccess] = useState(false);
	const { id } = useParams();

	useEffect(() => {
		const startDimmed = Boolean(result.member.paused_date && cards.length);
		setDimmed(startDimmed);
	}, [result.member]);

	const handleValues = (e, v) => setInput({ ...input, [v.name]: v.value });
	const handleUpload = (e, v) => setInput({ ...input, [v.name]: e.target.files[0] });
	const handleChange = (e) => handleValues(e, e.currentTarget);
	const handleCheck = (e, v) => setInput({ ...input, [v.name]: v.checked });

	const handleSubmit = (e) => {
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
			<Form onSubmit={handleSubmit}>
				<Header size='small'>Add a Card</Header>

				<Form.Group widths='equal'>
					<Form.Input
						label='Card Number'
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

				{success && <p>Success!</p>}
				<Form.Button loading={loading} error={error.non_field_errors}>
					Submit
				</Form.Button>
			</Form>

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
						Member paused, {cards.length} card{cards.length === 1 ? '' : 's'} ignored anyway.
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
	const [yousure, setYousure] = useState(false);
	const { id } = useParams();

	useEffect(() => {
		setLoading(false);
	}, [result.member]);

	const handlePause = (e) => {
		if (yousure) {
			setLoading(true);
			setSuccess(false);
			requester('/members/' + id + '/pause/', 'POST', token, {})
			.then(res => {
				setYousure(false);
				setSuccess(true);
				setError(false);
				refreshResult();
			})
			.catch(err => {
				setLoading(false);
				console.log(err);
				setError(true);
			});
		} else {
			setYousure(true);
		}
	};

	const handleUnpause = (e) => {
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

			{success && <p>Success!</p>}
			{error && <p>Error, something went wrong.</p>}

			{result.member.paused_date ?
				<Button onClick={handleUnpause} loading={loading}>
					Unpause
				</Button>
			:
				<Button onClick={handlePause} loading={loading}>
					{yousure ? 'You Sure?' : 'Pause'}
				</Button>
			}
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
		setLoading(true);
		setSuccess(false);
		requester('/members/' + id + '/', 'PATCH', token, input)
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
					label='Email'
					{...makeProps('email')}
				/>

				<Form.Input
					label='Application Date'
					{...makeProps('application_date')}
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
					<label>Is the member a director?</label>
					<Checkbox
						label='Yes'
						name='is_director'
						onChange={handleCheck}
						checked={input.is_director}
					/>
				</Form.Field>

				<Form.Field>
					<label>Is the member portal staff?</label>
					<Checkbox
						label='Yes'
						name='is_staff'
						onChange={handleCheck}
						checked={input.is_staff}
					/>
				</Form.Field>

				<Form.Field>
					<label>Is the member an instructor?</label>
					<Checkbox
						label='Yes'
						name='is_instructor'
						onChange={handleCheck}
						checked={input.is_instructor}
					/>
				</Form.Field>

				{success && <p>Success!</p>}
				<Form.Button loading={loading} error={error.non_field_errors}>
					Submit
				</Form.Button>
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
						<Table.Cell>Address:</Table.Cell>
						<Table.Cell>{member.street_address}</Table.Cell>
					</Table.Row>
					<Table.Row>
						<Table.Cell>City:</Table.Cell>
						<Table.Cell>{member.city}</Table.Cell>
					</Table.Row>
					<Table.Row>
						<Table.Cell>Postal:</Table.Cell>
						<Table.Cell>{member.postal_code}</Table.Cell>
					</Table.Row>

					<Table.Row>
						<Table.Cell>Minor:</Table.Cell>
						<Table.Cell>{member.is_minor ? 'Yes' : 'No'}</Table.Cell>
					</Table.Row>
					{member.is_minor && <Table.Row>
						<Table.Cell>Birthdate:</Table.Cell>
						<Table.Cell>{member.birthdate}</Table.Cell>
					</Table.Row>}
					{member.is_minor && <Table.Row>
						<Table.Cell>Guardian:</Table.Cell>
						<Table.Cell>{member.guardian_name}</Table.Cell>
					</Table.Row>}

					<Table.Row>
						<Table.Cell>Emergency Contact Name:</Table.Cell>
						<Table.Cell>{member.emergency_contact_name || 'None'}</Table.Cell>
					</Table.Row>
					<Table.Row>
						<Table.Cell>Emergency Contact Phone:</Table.Cell>
						<Table.Cell>{member.emergency_contact_phone || 'None'}</Table.Cell>
					</Table.Row>
				</Table.Body>
			</BasicTable>
		</div>
	);
};
