import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Switch, Route, Link, useParams, useLocation } from 'react-router-dom';
import './light.css';
import { Container, Divider, Dropdown, Form, Grid, Header, Icon, Image, Menu, Message, Segment, Table } from 'semantic-ui-react';
import { requester } from './utils.js';

export function LoginForm(props) {
	const [input, setInput] = useState({ username: '' });
	const [error, setError] = useState({});
	const [loading, setLoading] = useState(false);

	const handleValues = (e, v) => setInput({ ...input, [v.name]: v.value });
	const handleChange = (e) => handleValues(e, e.currentTarget);

	const handleSubmit = (e) => {
		if (input.username.includes('@')) {
			setError({ username: 'Username, not email.' });
		} else {
			if (loading) return;
			setLoading(true);
			const data = { ...input, username: input.username.toLowerCase() };
			requester('/rest-auth/login/', 'POST', '', data)
			.then(res => {
				setError({});
				props.setTokenCache(res.key);
				window.scrollTo(0, 0);
			})
			.catch(err => {
				setLoading(false);
				console.log(err);
				setError(err.data);
			});
		}
	};

	return (
		<Form
			onSubmit={handleSubmit}
			warning={error.non_field_errors && error.non_field_errors[0] === 'Unable to log in with provided credentials.'}
		>
			<Header size='medium'>Log In to Spaceport</Header>

			<Message warning>
				<Message.Header>First time at the new portal?</Message.Header>
				<p>Sign up below from Protospace Wi-Fi / computers.</p>
			</Message>

			<Form.Input
				label='Username'
				name='username'
				placeholder='first.last'
				onChange={handleChange}
				error={error.username}
			/>
			<Form.Input
				label='Password'
				name='password'
				type='password'
				onChange={handleChange}
				error={error.password}
			/>
			<Form.Button loading={loading} error={error.non_field_errors}>
				Log In
			</Form.Button>
		</Form>
	);
};

export function SignupForm(props) {
	const [input, setInput] = useState({ email: '' });
	const [error, setError] = useState({});
	const [loading, setLoading] = useState(false);
	const location = useLocation();

	const bypass_code = location.hash.replace('#', '');

	const handleValues = (e, v) => setInput({ ...input, [v.name]: v.value });
	const handleChange = (e) => handleValues(e, e.currentTarget);

	const genUsername = () => (
		input.first_name && input.last_name ?
			(input.first_name + '.' + input.last_name).toLowerCase().replace(/ /g, '.')
		:
			''
	);

	const handleSubmit = (e) => {
		if (loading) return;
		setLoading(true);
		input.username = genUsername();
		const data = { ...input, email: input.email.toLowerCase(), bypass_code: bypass_code };
		requester('/registration/', 'POST', '', data)
		.then(res => {
			setError({});
			props.setTokenCache(res.key);
			window.scrollTo(0, 0);
		})
		.catch(err => {
			setLoading(false);
			console.log(err);
			setError(err.data);
		});
	};

	return (
		<Form onSubmit={handleSubmit}>
			<Header size='medium'>Sign Up from Protospace</Header>

			<Form.Group widths='equal'>
				<Form.Input
					label='First Name'
					name='first_name'
					fluid
					onChange={handleChange}
					error={error.first_name}
				/>
				<Form.Input
					label='Last Name'
					name='last_name'
					fluid
					onChange={handleChange}
					error={error.last_name}
				/>
			</Form.Group>

			<Form.Input
				label='Username'
				name='username'
				value={genUsername()}
				error={error.username}
				readOnly
			/>
			<Form.Input
				label='Email'
				name='email'
				onChange={handleChange}
				error={error.email}
			/>

			<Form.Group grouped>
				<Form.Radio
					label='I have an account on the old portal'
					name='existing_member'
					value={'true'}
					checked={input.existing_member === 'true'}
					onChange={handleValues}
					error={!!error.existing_member}
				/>
				<Form.Radio
					label='I am new to Protospace'
					name='existing_member'
					value={'false'}
					checked={input.existing_member === 'false'}
					onChange={handleValues}
					error={!!error.existing_member}
				/>
			</Form.Group>

			<Form.Input
				label='Password'
				name='password1'
				type='password'
				onChange={handleChange}
				error={error.password1}
			/>
			<Form.Input
				label='Confirm Password'
				name='password2'
				type='password'
				onChange={handleChange}
				error={error.password2}
			/>

			<Form.Button loading={loading} error={error.non_field_errors}>
				Sign Up
			</Form.Button>
		</Form>
	);
};
