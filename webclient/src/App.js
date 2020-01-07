import React, { useState } from 'react';
import './light.css';
import Logo from './logo.svg';
import { Container, Divider, Form, Grid, Header, Menu, Message } from 'semantic-ui-react';
import { requester } from './utils.js';

function LoginForm() {
	const [input, setInput] = useState({})
	const [error, setError] = useState({})

	const handleChange = (e) => setInput({
		...input,
		[e.currentTarget.name]: e.currentTarget.value
	});

	const handleSubmit = (e) => {
		requester('/rest-auth/login/', 'POST', input)
		.then(res => {
			console.log(res);
			setError({});
		})
		.catch(err => {
			console.log(err);
			setError(err.data);
		});
	};

	return (
		<Form onSubmit={handleSubmit}>
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
			<Form.Button error={error.non_field_errors}>
				Login
			</Form.Button>
		</Form>
	);
}

function SignupForm() {
	const [input, setInput] = useState({})

	const handleChange = (e) => setInput({
		...input,
		[e.currentTarget.name]: e.currentTarget.value
	});

	const handleSubmit = (e) => {
		console.log(input);
	}

	return (
		<Form onSubmit={handleSubmit}>
			<Form.Group widths='equal'>
				<Form.Input
					label='First Name'
					name='firstname'
					onChange={handleChange}
				/>
				<Form.Input
					label='Last Name'
					name='lastname'
					onChange={handleChange}
				/>
			</Form.Group>

			<Form.Input
				label='Password'
				name='password1'
				type='password'
				onChange={handleChange}
			/>
			<Form.Input
				label='Confirm Password'
				name='password2'
				type='password'
				onChange={handleChange}
			/>
			<Form.Input
				label='Email'
				name='email'
				onChange={handleChange}
			/>
			<Form.Button>Sign Up</Form.Button>
		</Form>
	);
}

function App() {
	return (
		<div>
			<Container>
				<header className='header'>
					<img src={Logo} className='logo' />
				</header>
			</Container>

			<Menu>
			<Container>
				<Menu.Item
					content='Home'
				/>
				<Menu.Item
					content='About'
				/>
				<Menu.Item
					content='Contact'
				/>
			</Container>
			</Menu>

			<Container>
				<Grid stackable padded columns={2}>
					<Grid.Column>
						<Header size='medium'>Login to Spaceport</Header>

						<LoginForm />

						<Divider section horizontal>Or</Divider>

						<Header size='medium'>Sign Up</Header>
						<SignupForm />
					</Grid.Column>
					<Grid.Column>
						<p>two</p>
					</Grid.Column>
				</Grid>
			</Container>
		</div>
	);
}

export default App;
