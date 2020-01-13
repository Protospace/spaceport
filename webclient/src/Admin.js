import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Switch, Route, Link, useParams, useHistory } from 'react-router-dom';
import './light.css';
import { Container, Checkbox, Divider, Dropdown, Form, Grid, Header, Icon, Image, Menu, Message, Segment, Table } from 'semantic-ui-react';
import { BasicTable, staticUrl, requester } from './utils.js';

export function AdminMemberForm(props) {
	const [input, setInput] = useState(false);
	const [error, setError] = useState(false);
	const [loading, setLoading] = useState(false);
	const [success, setSuccess] = useState(false);
	const { id } = useParams();

	const handleValues = (e, v) => setInput({ ...input, [v.name]: v.value });
	const handleUpload = (e, v) => setInput({ ...input, [v.name]: e.target.files[0] });
	const handleChange = (e) => handleValues(e, e.currentTarget);
	const handleCheck = (e, v) => setInput({ ...input, [v.name]: v.checked });

	useEffect(() => {
		requester('/members/'+id+'/', 'GET', props.token)
		.then(res => {
			setInput(res);
		})
		.catch(err => {
			console.log(err);
			setError(true);
		});
	}, []);

	const handleSubmit = (e) => {
		setLoading(true);
		setSuccess(false);
		requester('/members/' + id + '/', 'PATCH', props.token, input)
		.then(res => {
			setLoading(false);
			setSuccess(true);
			setError(false);
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
			{!error ?
				input ?
					<Form onSubmit={handleSubmit}>
						<Header size='medium'>Edit Member Details</Header>

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
							{...makeProps('Expire Date')}
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
				:
					<p>Loading...</p>
			:
				<p>Error loading member</p>
			}
		</div>
	);
};

export function AdminMemberInfo(props) {
	const [member, setMember] = useState(false);
	const [error, setError] = useState(false);
	const { id } = useParams();

	useEffect(() => {
		requester('/members/'+id+'/', 'GET', props.token)
		.then(res => {
			setMember(res);
		})
		.catch(err => {
			console.log(err);
			setError(true);
		});
	}, []);

	return (
		<div>
			{!error ?
				member ?
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
									<Table.Cell>Email:</Table.Cell>
									<Table.Cell>{member.email}</Table.Cell>
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
									<Table.Cell>{member.emergency_contact_name}</Table.Cell>
								</Table.Row>
								<Table.Row>
									<Table.Cell>Emergency Contact Phone:</Table.Cell>
									<Table.Cell>{member.emergency_contact_phone}</Table.Cell>
								</Table.Row>
							</Table.Body>
						</BasicTable>
					</div>
				:
					<p>Loading...</p>
			:
				<p>Error loading member</p>
			}
		</div>
	);
};
