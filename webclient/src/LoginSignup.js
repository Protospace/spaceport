import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Switch, Route, Link, useParams, useLocation } from 'react-router-dom';
import './light.css';
import { Container, Divider, Dropdown, Form, Grid, Header, Icon, Image, Menu, Message, Segment, Table } from 'semantic-ui-react';
import { requester, randomString } from './utils.js';

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

			<Form.Input
				label='Username'
				name='username'
				placeholder='first.last'
				onChange={handleChange}
				error={error.username}
				autoFocus
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

			<Message warning>
				<Message.Header>Forgot your password?</Message.Header>
				<p><Link to='/password/reset/'>Click here</Link> to reset it.</p>
			</Message>
		</Form>
	);
};

export function SignupForm(props) {
	const [input, setInput] = useState({ email: '' });
	const [error, setError] = useState({});
	const [progress, setProgress] = useState([]);
	const [loading, setLoading] = useState(false);
	const location = useLocation();

	const handleValues = (e, v) => setInput({ ...input, [v.name]: v.value });
	const handleChange = (e) => handleValues(e, e.currentTarget);

	const genUsername = () => {
		if (input.first_name && input.last_name) {
			let first_name = input.first_name.trim().toLowerCase();
			let last_name = input.last_name.trim().toLowerCase();
			first_name = first_name.replace(/[^a-z- ]+/g, '');
			last_name = last_name.replace(/[^a-z- ]+/g, '');
			first_name = first_name.replace(/[ -]/g, '.');
			last_name = last_name.replace(/[ -]/g, '.');
			return first_name + '.' + last_name;
		} else {
			return '';
		}
	};

	const handleSubmit = (e) => {
		if (loading) return;
		setLoading(true);
		input.username = genUsername();

		const request_id = randomString();
		const getStatus = () => {
			requester('/stats/progress/?request_id='+request_id, 'GET')
			.then(res => {
				setProgress(res);
			})
			.catch(err => {
				console.log(err);
			});
		};
		const interval = setInterval(getStatus, 500);

		const data = { ...input, email: input.email.toLowerCase(), request_id: request_id };

		requester('/registration/', 'POST', '', data)
		.then(res => {
			clearInterval(interval);
			setError({});
			props.setTokenCache(res.key);
			window.scrollTo(0, 0);
		})
		.catch(err => {
			clearInterval(interval);
			setLoading(false);
			console.log(err);
			setError(err.data);
		});
	};

	return (
		<Form onSubmit={handleSubmit}>
			<Header size='medium'>Sign Up to Spaceport</Header>

			{props.show_signup ?
				<>
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
							value={true}
							checked={input.existing_member === true}
							onChange={handleValues}
							error={!!error.existing_member}
						/>
						<Form.Radio
							label='I am new to Protospace'
							name='existing_member'
							value={false}
							checked={input.existing_member === false}
							onChange={handleValues}
							error={!!error.existing_member}
						/>
					</Form.Group>

					{input.existing_member && <Message info>
						<Message.Header>Welcome back!</Message.Header>
						<p>Please do a <Link to='/password/reset'>password reset</Link> instead.</p>
					</Message>}

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

					<p>
						{progress.map(x => <>{x}<br /></>)}
					</p>

					<Form.Button loading={loading} error={error.non_field_errors} disabled={input.existing_member !== false}>
						Sign Up
					</Form.Button>
				</>
			:
				<>
					<Message info>
						<Message.Header>Please Visit Protospace</Message.Header>
						<p>You'll need to sign a waiver and fill out member forms.</p>
					</Message>
					<p>
						Our address: <br />
						1530 27th Avenue NE <br />
						Bay 108 <br />
						Calgary, Alberta, Canada
					</p>
					<p><a href="https://goo.gl/maps/u1NeC71HzUEUhe7N9" target="_blank">Google Maps Link</a></p>
				</>
			}
		</Form>
	);
};
