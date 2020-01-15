import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Switch, Route, Link, useParams, useHistory } from 'react-router-dom';
import './light.css';
import { Container, Checkbox, Divider, Dropdown, Form, Grid, Header, Icon, Image, Menu, Message, Segment, Table } from 'semantic-ui-react';
import { BasicTable, staticUrl, requester } from './utils.js';

function AdminCardDetail(props) {
	const [input, setInput] = useState({ ...props.card });
	const [error, setError] = useState(false);
	const [loading, setLoading] = useState(false);
	const [success, setSuccess] = useState(false);
	const id = props.card.id;

	const handleValues = (e, v) => setInput({ ...input, [v.name]: v.value });
	const handleUpload = (e, v) => setInput({ ...input, [v.name]: e.target.files[0] });
	const handleChange = (e) => handleValues(e, e.currentTarget);
	const handleCheck = (e, v) => setInput({ ...input, [v.name]: v.checked });

	const handleSubmit = (e) => {
		setLoading(true);
		setSuccess(false);
		const data = { ...input, member_id: props.result.member.id };
		requester('/cards/'+id+'/', 'PUT', props.token, data)
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

		requester('/cards/'+id+'/', 'DELETE', props.token)
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
				Deleted card: {props.card.card_number}
			</Segment>
	);
};

export function AdminMemberCards(props) {
	const cards = props.result.cards;
	const [input, setInput] = useState({ active_status: 'card_active' });
	const [error, setError] = useState(false);
	const [loading, setLoading] = useState(false);
	const [success, setSuccess] = useState(false);
	const { id } = useParams();

	const handleValues = (e, v) => setInput({ ...input, [v.name]: v.value });
	const handleUpload = (e, v) => setInput({ ...input, [v.name]: e.target.files[0] });
	const handleChange = (e) => handleValues(e, e.currentTarget);
	const handleCheck = (e, v) => setInput({ ...input, [v.name]: v.checked });

	const handleSubmit = (e) => {
		setLoading(true);
		setSuccess(false);
		const data = { ...input, member_id: props.result.member.id };
		requester('/cards/', 'POST', props.token, data)
		.then(res => {
			setLoading(false);
			setSuccess(true);
			setError(false);
			props.setResult({ ...props.result, cards: [...cards, res] });
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

			{cards.length ?
				cards.map((x, i) =>
					<AdminCardDetail key={i} card={x} {...props} />
				)
			:
				<p>None</p>
			}
		</div>
	);
};

export function AdminMemberForm(props) {
	const [input, setInput] = useState(props.result.member);
	const [error, setError] = useState(false);
	const [loading, setLoading] = useState(false);
	const [success, setSuccess] = useState(false);
	const { id } = useParams();

	const handleValues = (e, v) => setInput({ ...input, [v.name]: v.value });
	const handleUpload = (e, v) => setInput({ ...input, [v.name]: e.target.files[0] });
	const handleChange = (e) => handleValues(e, e.currentTarget);
	const handleCheck = (e, v) => setInput({ ...input, [v.name]: v.checked });

	const handleSubmit = (e) => {
		setLoading(true);
		setSuccess(false);
		requester('/members/' + id + '/', 'PATCH', props.token, input)
		.then(res => {
			setLoading(false);
			setSuccess(true);
			setError(false);
			props.setResult({ ...props.result, member: res });
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
					label='Expire Date'
					{...makeProps('expire_date')}
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
						<Table.Cell>{member.status}</Table.Cell>
					</Table.Row>

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
