import React, { useState, useEffect } from 'react';
import './light.css';
import Logo from './logo.svg';
import { Container, Divider, Form, Grid, Header, Icon, Image, Menu, Message, Segment, Table } from 'semantic-ui-react';
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
			<Header size='medium'>Enter New Member Details</Header>
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

function MemberInfo(props) {
	const user = props.user;
	const member = user.member;

	return (
		<div>
			<Header size='large'>
				<Icon.Group size='small'>
					<Icon name='circle' color='green' />
				</Icon.Group>
				<Header.Content>{member.first_name} {member.last_name}</Header.Content>
			</Header>

			<p>Preferred Name: {member.preferred_name || '???'}</p>
			<p>Email: {user.email}</p>

			<Grid stackable>
				<Grid.Column width={6}>
					<Image src='https://upload.wikimedia.org/wikipedia/commons/8/89/Portrait_Placeholder.png' size='small' />
				</Grid.Column>

				<Grid.Column width={10}>
					<Table unstackable basic='very'>
						<Table.Body>
							<Table.Row>
								<Table.Cell>Expiry:</Table.Cell>
								<Table.Cell>2099-01-01</Table.Cell>
							</Table.Row>
							<Table.Row>
								<Table.Cell>Status:</Table.Cell>
								<Table.Cell>Current</Table.Cell>
							</Table.Row>
							<Table.Row>
								<Table.Cell>Application:</Table.Cell>
								<Table.Cell>{member.application_date || '???'}</Table.Cell>
							</Table.Row>
							<Table.Row>
								<Table.Cell>Start:</Table.Cell>
								<Table.Cell>{member.current_start_date || '???'}</Table.Cell>
							</Table.Row>
							<Table.Row>
								<Table.Cell>Vetted:</Table.Cell>
								<Table.Cell>{member.vetted_date || 'Not vetted'}</Table.Cell>
							</Table.Row>
							<Table.Row>
								<Table.Cell>Monthly</Table.Cell>
								<Table.Cell>${member.monthly_fees || '???'}</Table.Cell>
							</Table.Row>
						</Table.Body>
					</Table>
				</Grid.Column>
			</Grid>
		</div>
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

	const menuName = user.member && user.member.preferred_name || 'Me';

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
					content={menuName}
				/>
				<Menu.Item
					content='Space'
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
								<MemberInfo user={user} />
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
						<Segment>
							<Header size='medium'>Portal</Header>
							<p>Welcome to the Protospace member portal! Here you can view member info, join classes, and manage your membership.</p>

							<Header size='medium'>Quick Links</Header>
							<p><a href='http://protospace.ca/' target='_blank' rel='noopener noreferrer'>Main Website</a></p>
							<p><a href='http://wiki.protospace.ca/Welcome_to_Protospace' target='_blank' rel='noopener noreferrer'>Protospace Wiki</a></p>
							<p><a href='https://groups.google.com/forum/#!forum/protospace-discuss' target='_blank' rel='noopener noreferrer'>Discussion Google Group</a></p>
							<p><a href='https://drive.google.com/open?id=0By-vvp6fxFekfmU1cmdxaVRlaldiYXVyTE9rRnNVNjhkc3FjdkFIbjBwQkZ3MVVQX2Ezc3M' target='_blank' rel='noopener noreferrer'>Google Drive</a></p>

							<Header size='medium'>Protospace Stats</Header>
							<p>Next member meeting: Jan 01, 2099</p>
							<p>Next monthly clean: Jan 01, 2099</p>
							<p>Current member count: 200</p>
							<p>Due members: 20</p>
							<p>Expired members: 100</p>
							<p>Bay 108 temperature: 21 C</p>
							<p>Bay 110 temperature: 22 C</p>

						</Segment>
					</Grid.Column>
				</Grid>
			</Container>
		</div>
	);
}

export default App;
