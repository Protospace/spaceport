import React, { useState, useEffect } from 'react';
import './light.css';
import Logo from './logo.svg';
import { Container, Divider, Form, Grid, Header, Icon, Menu, Message } from 'semantic-ui-react';
import { requester } from './utils.js';

function LoginForm(props) {
	const [input, setInput] = useState({});
	const [error, setError] = useState({});
	const [loading, setLoading] = useState(false);

	const handleValues = (e, v) => setInput({
		...input,
		[v.name]: v.value
	});

	const handleChange = (e) => handleValues(e, e.currentTarget);

	const handleSubmit = (e) => {
		setLoading(true);
		requester('/rest-auth/login/', 'POST', '', input)
		.then(res => {
			console.log(res);
			setError({});
			props.setTokenCache(res.key);
		})
		.catch(err => {
			setLoading(false);
			console.log(err);
			setError(err.data);
		});
	};

	return (
		<Form onSubmit={handleSubmit}>
			<Header size='medium'>Login to Spaceport</Header>
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
				Login
			</Form.Button>
		</Form>
	);
}

function SignupForm(props) {
	const [input, setInput] = useState({});
	const [error, setError] = useState({});
	const [loading, setLoading] = useState(false);

	const handleValues = (e, v) => setInput({
		...input,
		[v.name]: v.value
	});

	const handleChange = (e) => handleValues(e, e.currentTarget);

	const genUsername = () => (
		input.first_name && input.last_name ?
			(input.first_name + '.' + input.last_name).toLowerCase()
		:
			''
	);

	const handleSubmit = (e) => {
		setLoading(true);
		input.username = genUsername();
		requester('/registration/', 'POST', '', input)
		.then(res => {
			console.log(res);
			setError({});
			props.setTokenCache(res.key);
		})
		.catch(err => {
			setLoading(false);
			console.log(err);
			setError(err.data);
		});
	};

	return (
		<Form onSubmit={handleSubmit}>
			<Header size='medium'>Sign Up</Header>
			<Form.Group widths='equal'>
				<Form.Input
					label='First Name'
					name='first_name'
					onChange={handleChange}
					error={error.first_name}
				/>
				<Form.Input
					label='Last Name'
					name='last_name'
					onChange={handleChange}
					error={error.last_name}
				/>
			</Form.Group>

			<Form.Input
				label='Username'
				name='username'
				value={genUsername()}
				error={error.username}
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
}

function DetailsForm(props) {
	const member = props.user.member;
	const [input, setInput] = useState({
		preferred_name: member.preferred_name,
		phone: member.phone,
		emergency_contact_name: member.emergency_contact_name,
		emergency_contact_phone: member.emergency_contact_phone,
		set_details: true,
	});
	const [error, setError] = useState({});
	const [loading, setLoading] = useState(false);

	const handleValues = (e, v) => setInput({
		...input,
		[v.name]: v.value
	});

	const handleChange = (e) => handleValues(e, e.currentTarget);

	const handleSubmit = (e) => {
		setLoading(true);
		requester('/members/' + member.id + '/', 'PATCH', props.token, input)
		.then(res => {
			console.log(res);
			setError({});
			props.setUserCache({...props.user, member: res});
		})
		.catch(err => {
			setLoading(false);
			console.log(err);
			setError(err.data);
		});
	};

	return (
		<Form onSubmit={handleSubmit}>
			<Header size='medium'>Enter Details</Header>
			<Form.Input
				label='Preferred Name'
				name='preferred_name'
				onChange={handleChange}
				value={input.preferred_name}
				error={error.preferred_name}
			/>
			<Form.Input
				label='Phone Number (999) 555-1234'
				name='phone'
				onChange={handleChange}
				value={input.phone}
				error={error.phone}
			/>
			<Form.Input
				label='Emergency Contact Name'
				name='emergency_contact_name'
				onChange={handleChange}
				value={input.emergency_contact_name}
				error={error.emergency_contact_name}
			/>
			<Form.Input
				label='Emergency Contact Phone'
				name='emergency_contact_phone'
				onChange={handleChange}
				value={input.emergency_contact_phone}
				error={error.emergency_contact_phone}
			/>

			<Form.Button loading={loading} error={error.non_field_errors}>
				Submit
			</Form.Button>
		</Form>
	);
}

function App() {
	const [token, setToken] = useState(localStorage.getItem('token', ''));
	const [user, setUser] = useState(JSON.parse(localStorage.getItem('user', 'false')));

	const setTokenCache = (x) => {
		setToken(x);
		localStorage.setItem('token', x);
	}

	const setUserCache = (x) => {
		setUser(x);
		localStorage.setItem('user', JSON.stringify(x));
	}

	useEffect(() => {
		requester('/me/', 'GET', token)
		.then(res => {
			console.log(res);
			setUserCache(res);
		})
		.catch(err => {
			console.log(err);
			setUser(false);
		});
	}, [token]);

	const logout = () => {
		setTokenCache('');
		setUserCache(false);
	}

	return (
		<div>
			<Container>
				<div className='header'>
					<img src={Logo} className='logo' />
				</div>
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

				{user && <Menu.Menu position='right'>
					<Menu.Item
						content='Logout'
						onClick={logout}
					/>
				</Menu.Menu>}
			</Container>
			</Menu>

			<Container>
				<Grid stackable padded columns={2}>
					<Grid.Column>
						{user ?
							user.member.set_details ?
								<p>yay welcome {user.member.first_name}</p>
							:
								<DetailsForm token={token} user={user} setUserCache={setUserCache} />
						:
							<div>
								<LoginForm setTokenCache={setTokenCache} />

								<Divider section horizontal>Or</Divider>

								<SignupForm setTokenCache={setTokenCache} />
							</div>
						}
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
