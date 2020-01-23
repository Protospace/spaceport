import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Switch, Route, Link, useParams, useHistory } from 'react-router-dom';
import './light.css';
import { Container, Checkbox, Divider, Dropdown, Form, Grid, Header, Icon, Image, Menu, Message, Segment, Table } from 'semantic-ui-react';
import { BasicTable, staticUrl, requester } from './utils.js';
import { LoginForm, SignupForm } from './LoginSignup.js';

function ChangePasswordForm(props) {
	const { token } = props;
	const [input, setInput] = useState({});
	const [error, setError] = useState({});
	const [loading, setLoading] = useState(false);
	const history = useHistory();

	const handleValues = (e, v) => setInput({ ...input, [v.name]: v.value });
	const handleUpload = (e, v) => setInput({ ...input, [v.name]: e.target.files[0] });
	const handleChange = (e) => handleValues(e, e.currentTarget);

	const handleSubmit = (e) => {
		setLoading(true);
		requester('/password/change/', 'POST', token, input)
		.then(res => {
			setError({});
			history.push('/');
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
		<Form onSubmit={handleSubmit}>
			<Header size='medium'>Change Password</Header>

			<Form.Input
				label='Old Password'
				type='password'
				required
				{...makeProps('old_password')}
			/>
			<Form.Input
				label='New Password'
				type='password'
				required
				{...makeProps('new_password1')}
			/>
			<Form.Input
				label='Confirm Password'
				type='password'
				required
				{...makeProps('new_password2')}
			/>

			<Form.Button loading={loading} error={error.non_field_errors}>
				Submit
			</Form.Button>
		</Form>
	);
};

export function AccountForm(props) {
	const { token, user, refreshUser } = props;
	const member = user.member;
	const [input, setInput] = useState({ ...member, set_details: true });
	const [error, setError] = useState({});
	const [loading, setLoading] = useState(false);
	const history = useHistory();

	const handleValues = (e, v) => setInput({ ...input, [v.name]: v.value });
	const handleUpload = (e, v) => setInput({ ...input, [v.name]: e.target.files[0] });
	const handleChange = (e) => handleValues(e, e.currentTarget);
	const handleCheck = (e, v) => setInput({ ...input, [v.name]: v.checked });

	const handleSubmit = (e) => {
		setLoading(true);
		requester('/members/' + member.id + '/', 'PATCH', token, input)
		.then(res => {
			setError({});
			refreshUser();
			history.push('/');
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
		...(input[name] ? {} : {icon: 'edit'}),
	});

	return (
		<Form onSubmit={handleSubmit}>
			<Header size='medium'>Member Details</Header>

			<Form.Input
				label='Preferred First Name'
				required
				{...makeProps('preferred_name')}
			/>

			<Form.Input
				label='Email Address'
				required
				{...makeProps('email')}
			/>

			<Form.Input
				label='Phone Number (999) 555-1234'
				required
				{...makeProps('phone')}
			/>

			<Form.Input
				label='Street Address'
				required
				{...makeProps('street_address')}
			/>
			<Form.Input
				label='City, Province'
				required
				{...makeProps('city')}
			/>
			<Form.Input
				label='Postal Code'
				required
				{...makeProps('postal_code')}
			/>

			<Form.Field>
				<label>Are you under 18 years old?</label>
				<Checkbox
					label='I am a minor'
					name='is_minor'
					onChange={handleCheck}
					checked={input.is_minor}
				/>
			</Form.Field>

			{input.is_minor && <Form.Input
				label='Birthdate YYYY-MM-DD'
				{...makeProps('birthdate')}
			/>}
			{input.is_minor && <Form.Input
				label="Guardian's Name"
				{...makeProps('guardian_name')}
			/>}

			<Form.Input
				label='Emergency Contact Name'
				{...makeProps('emergency_contact_name')}
			/>
			<Form.Input
				label='Emergency Contact Phone'
				{...makeProps('emergency_contact_phone')}
			/>

			<Form.Input
				label='Member Photo'
				name='photo'
				type='file'
				accept='image/*'
				onChange={handleUpload}
			/>

			<Form.Button loading={loading} error={error.non_field_errors}>
				Submit
			</Form.Button>
		</Form>
	);
};

export function Account(props) {
	return (
		<Container>
			<Header size='large'>Account Settings</Header>
			<Grid stackable columns={2}>
				<Grid.Column>
					<Segment padded><AccountForm {...props} /></Segment>
				</Grid.Column>
				<Grid.Column>
					<Segment padded><ChangePasswordForm {...props} /></Segment>
				</Grid.Column>
			</Grid>
		</Container>
	);
};
