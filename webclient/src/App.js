import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Switch, Route, Link, useParams } from 'react-router-dom';
import './light.css';
import Logo from './logo.svg';
import { Container, Divider, Dropdown, Form, Grid, Header, Icon, Image, Menu, Message, Segment, Table } from 'semantic-ui-react';
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
};

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
};

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
			<Header size='medium'>Enter Member Details</Header>
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
};

function MemberInfo(props) {
	const user = props.user;
	const member = user.member;

	const lastTrans = user.transactions && user.transactions.slice(-3).slice().reverse();
	const lastCard = user.cards && user.cards.sort((a, b) => a.last_seen_at < b.last_seen_at)[0];

	return (
		<div>
			<Grid stackable>
				<Grid.Column width={6}>
					<Image src='https://upload.wikimedia.org/wikipedia/commons/8/89/Portrait_Placeholder.png' size='small' />
				</Grid.Column>

				<Grid.Column width={10}>
					<Header size='large'>
						<Icon.Group size='small'>
							<Icon name='circle' color='green' />
						</Icon.Group>
						<Header.Content>{member.first_name} {member.last_name}</Header.Content>
					</Header>

					<p>Preferred Name: {member.preferred_name || '???'}</p>
					<p>Email: {user.email}</p>
					<p>Status: Current</p>
				</Grid.Column>
			</Grid>

			<Header size='medium'>Details</Header>
			<Table unstackable basic='very'>
				<Table.Body>
					<Table.Row>
						<Table.Cell>Expiry:</Table.Cell>
						<Table.Cell>2099-01-01</Table.Cell>
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
						<Table.Cell>Monthly:</Table.Cell>
						<Table.Cell>${member.monthly_fees || '???'}</Table.Cell>
					</Table.Row>
					<Table.Row>
						<Table.Cell>Card Number:</Table.Cell>
						<Table.Cell>{lastCard && lastCard.card_number || 'None'}</Table.Cell>
					</Table.Row>
				</Table.Body>
			</Table>

			<Header size='medium'>Latest Transactions</Header>
			<Table unstackable basic='very'>
				<Table.Body>
					{lastTrans.length ?
						lastTrans.map((x, i) =>
							<Table.Row key={i}>
								<Table.Cell>{x.date}</Table.Cell>
								<Table.Cell>{x.account_type}</Table.Cell>
								<Table.Cell>${x.amount}</Table.Cell>
							</Table.Row>
						)
					:
						<p>None</p>
					}
				</Table.Body>
			</Table>
		</div>
	);
};

function Home(props) {
	const { token, setTokenCache, user, setUserCache } = props;

	return (
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
	);
};

function Transactions(props) {
	const { user } = props;

	return (
		<Container>
			<Header size='large'>Protospace Transactions</Header>

			<Table basic='very'>
				<Table.Header>
					<Table.Row>
						<Table.HeaderCell>Date</Table.HeaderCell>
						<Table.HeaderCell>ID</Table.HeaderCell>
						<Table.HeaderCell>Amount</Table.HeaderCell>
						<Table.HeaderCell>Account</Table.HeaderCell>
						<Table.HeaderCell>Memo</Table.HeaderCell>
					</Table.Row>
				</Table.Header>

				<Table.Body>
					{user.transactions.length ?
						user.transactions.slice().reverse().map((x, i) =>
							<Table.Row key={i}>
								<Table.Cell>{x.date}</Table.Cell>
								<Table.Cell><Link to={'/transactions/'+x.id}>{x.id}</Link></Table.Cell>
								<Table.Cell>${x.amount}</Table.Cell>
								<Table.Cell>{x.account_type}</Table.Cell>
								<Table.Cell>{x.memo}</Table.Cell>
							</Table.Row>
						)
					:
						<p>None</p>
					}
				</Table.Body>
			</Table>

		</Container>
	);
}

function TransactionDetail(props) {
	const { user } = props;
	const { id } = useParams();

	const t = user.transactions.find(x => x.id == id);

	return (
		t ?
			<Container>
				<Header size='large'>Transaction Receipt</Header>

				<Table unstackable basic='very'>
					<Table.Body>
						<Table.Row>
							<Table.Cell>Date:</Table.Cell>
							<Table.Cell>{t.date}</Table.Cell>
						</Table.Row>
						<Table.Row>
							<Table.Cell>ID:</Table.Cell>
							<Table.Cell>{t.id}</Table.Cell>
						</Table.Row>
						<Table.Row>
							<Table.Cell>Amount:</Table.Cell>
							<Table.Cell>${t.amount}</Table.Cell>
						</Table.Row>
						<Table.Row>
							<Table.Cell>Category:</Table.Cell>
							<Table.Cell>{t.category}</Table.Cell>
						</Table.Row>
						<Table.Row>
							<Table.Cell>Account:</Table.Cell>
							<Table.Cell>{t.account}</Table.Cell>
						</Table.Row>
						<Table.Row>
							<Table.Cell>Info Source:</Table.Cell>
							<Table.Cell>{t.info_source}</Table.Cell>
						</Table.Row>
						<Table.Row>
							<Table.Cell>Reference:</Table.Cell>
							<Table.Cell>{t.reference_number}</Table.Cell>
						</Table.Row>
						<Table.Row>
							<Table.Cell>Memo:</Table.Cell>
							<Table.Cell>{t.memo}</Table.Cell>
						</Table.Row>
					</Table.Body>
				</Table>

			</Container>
		:
			<NotFound />
	);
}

function PleaseLogin() {
	return (
		<Container text>
			<Message warning>
				<Message.Header style={{ padding: 0 }}>You must login before you can do that!</Message.Header>
				<p>Visit our <Link to='/'>login page</Link>, then try again.</p>
			</Message>
		</Container>
	);
};

function NotFound() {
	return (
		<Container text>
			<Message warning>
				<Message.Header style={{ padding: 0 }}>The page you requested can't be found!</Message.Header>
				<p>Visit our <Link to='/'>home page</Link> if you are lost.</p>
			</Message>
		</Container>
	);
};

function App() {
	const [token, setToken] = useState(localStorage.getItem('token', ''));
	const [user, setUser] = useState(JSON.parse(localStorage.getItem('user', 'false')));

	function setTokenCache(x) {
		setToken(x);
		localStorage.setItem('token', x);
	}

	function setUserCache(x) {
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

	function logout() {
		window.location = '/';
		setTokenCache('');
		setUserCache(false);
	}

	let menuName = user && user.member && user.member.preferred_name || 'Profile';
	menuName = menuName.length > 7 ? 'Profile' : menuName;

	return (
		<Router>
			<Container>
				<div className='header'>
					<img src={Logo} className='logo' />
				</div>
			</Container>

			<Menu>
				<Container>
					<Menu.Item
						content='Home'
						as={Link}
						to='/'
					/>

					<Dropdown item text={menuName} id='ps-menu'>
						<Dropdown.Menu>
							<Dropdown.Item
								content='Transactions'
								as={Link}
								to='/transactions'
							/>
							<Dropdown.Item
								content='Cards'
							/>
						</Dropdown.Menu>
					</Dropdown>

					<Dropdown item text='Space' id='ps-menu'>
						<Dropdown.Menu>
							<Dropdown.Item
								content='Members'
							/>
							<Dropdown.Item
								content='Courses'
							/>
						</Dropdown.Menu>
					</Dropdown>

					{user && <Menu.Menu position='right'>
						<Menu.Item
							content='Logout'
							onClick={logout}
							icon='cancel'
						/>
						<Menu.Item fitted content='' />
					</Menu.Menu>}
				</Container>
			</Menu>

			<Route exact path='/'>
				<Home token={token} setTokenCache={setTokenCache} user={user} setUserCache={setUserCache} />
			</Route>

			{user ?
				<Switch>
					<Route path='/transactions/:id'>
						<TransactionDetail user={user} />
					</Route>
					<Route path='/transactions'>
						<Transactions user={user} />
					</Route>

					<Route path='/:page'>
						<NotFound />
					</Route>
				</Switch>
			:
				<Route path='/:page'>
					<PleaseLogin />
				</Route>
			}

		</Router>
	)
};

export default App;
