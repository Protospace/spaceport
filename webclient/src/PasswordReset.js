import React, { useState, useEffect, useReducer, useContext } from 'react';
import { BrowserRouter as Router, Switch, Route, Link, useParams, useHistory } from 'react-router-dom';
import { Button, Container, Checkbox, Dimmer, Divider, Dropdown, Form, Grid, Header, Icon, Image, Menu, Message, Segment, Table } from 'semantic-ui-react';
import { apiUrl, statusColor, BasicTable, staticUrl, requester } from './utils.js';
import { NotFound } from './Misc.js';

function ResetForm() {
	const [input, setInput] = useState({});
	const [error, setError] = useState({});
	const [loading, setLoading] = useState(false);
	const [success, setSuccess] = useState(false);

	const handleValues = (e, v) => setInput({ ...input, [v.name]: v.value });
	const handleChange = (e) => handleValues(e, e.currentTarget);

	const handleSubmit = (e) => {
		if (loading) return;
		setLoading(true);
		requester('/password/reset/', 'POST', '', input)
		.then(res => {
			setLoading(false);
			setSuccess(true);
			setError({});
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
		<Form onSubmit={handleSubmit} error={error.email == 'Not found.'}>
			<Form.Input
				label='Email'
				name='email'
				onChange={handleChange}
				error={error.email}
			/>

			<Message
				error
				header='Email not found in Spaceport'
				content='Ask a director if you forgot which one you used.'
			/>

			<Form.Button loading={loading} error={error.non_field_errors}>
				Submit
			</Form.Button>
			{loading && <div>Give me like 30 seconds...</div>}
			{success && <div>Success! Be sure to check your <b>spam folder</b>.</div>}
		</Form>
	);
};

function ConfirmForm() {
	const { uid, token } = useParams();
	const [input, setInput] = useState({ uid: uid, token: token });
	const [error, setError] = useState({});
	const [loading, setLoading] = useState(false);
	const [success, setSuccess] = useState(false);
	const history = useHistory();

	const handleValues = (e, v) => setInput({ ...input, [v.name]: v.value });
	const handleChange = (e) => handleValues(e, e.currentTarget);

	const handleSubmit = (e) => {
		if (loading) return;
		setLoading(true);
		requester('/password/reset/confirm/', 'POST', '', input)
		.then(res => {
			setLoading(false);
			setSuccess(true);
			setError({});
			history.push('/');
			window.scrollTo(0, 0);
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
			<Form.Input
				label='New Password'
				type='password'
				{...makeProps('new_password1')}
			/>
			<Form.Input
				label='Confirm Password'
				type='password'
				{...makeProps('new_password2')}
			/>

			{(error.token || error.uid) && <p>Error: Invalid password reset URL! Try doing another reset.</p>}

			<Form.Button loading={loading} error={error.non_field_errors}>
				Submit
			</Form.Button>
			{success && <div>Success!</div>}
		</Form>
	);
};


export function PasswordReset() {
	return (
		<Container>
			<Header size='large'>Password Reset</Header>
			<Grid stackable columns={2}>
				<Grid.Column>
					<p>
						Enter your email and we will send you a password reset link.
					</p>

					<ResetForm />
				</Grid.Column>
			</Grid>
		</Container>
	);
};

export function ConfirmReset() {
	return (
		<Container>
			<Header size='large'>Password Reset</Header>
			<Grid stackable columns={2}>
				<Grid.Column>
					<p>
						Choose a new password.
					</p>

					<ConfirmForm />
				</Grid.Column>
			</Grid>
		</Container>
	);
};
