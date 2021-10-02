import React, { useState, useEffect, useReducer } from 'react';
import { BrowserRouter as Router, Switch, Route, Link, useParams, useLocation } from 'react-router-dom';
import moment from 'moment-timezone';
import './light.css';
import { Container, Divider, Dropdown, Form, Grid, Header, Icon, Image, Menu, Message, Popup, Segment, Table } from 'semantic-ui-react';
import { statusColor, BasicTable, staticUrl, requester, isAdmin } from './utils.js';

export function AuthForm(props) {
	const { user } = props;
	const username = user ? user.username : '';
	const [input, setInput] = useState({ username: username });
	const [error, setError] = useState({});
	const [success, setSuccess] = useState(false);
	const [loading, setLoading] = useState(false);

	const handleValues = (e, v) => setInput({ ...input, [v.name]: v.value });
	const handleChange = (e) => handleValues(e, e.currentTarget);

	const handleSubmit = (e) => {
		if (input.username.includes('@')) {
			setError({ username: 'Spaceport username, not email.' });
		} else {
			if (loading) return;
			setLoading(true);
			const data = { ...input, username: input.username.toLowerCase() };
			requester('/spaceport-auth/login/', 'POST', '', data)
			.then(res => {
				setSuccess(true);
				setError({});
			})
			.catch(err => {
				setLoading(false);
				console.log(err);
				setError(err.data);
			});
		}
	};

	return (
		success ?
			props.children
		:
			<Form
				onSubmit={handleSubmit}
				warning={error.non_field_errors && error.non_field_errors[0] === 'Unable to log in with provided credentials.'}
			>
				<Header size='medium'>Log In to Spaceport</Header>

				{user ?
					<><Form.Input
						label='Spaceport Username'
						name='username'
						value={user.username}
						onChange={handleChange}
						error={error.username}
					/>
					<Form.Input
						label='Spaceport Password'
						name='password'
						type='password'
						onChange={handleChange}
						error={error.password}
						autoFocus
					/></>
				:
					<><Form.Input
						label='Spaceport Username'
						name='username'
						placeholder='first.last'
						onChange={handleChange}
						error={error.username}
						autoFocus
					/>
					<Form.Input
						label='Spaceport Password'
						name='password'
						type='password'
						onChange={handleChange}
						error={error.password}
					/></>
				}

				<Form.Button loading={loading} error={error.non_field_errors}>
					Authorize
				</Form.Button>

				<Message warning>
					<Message.Header>Forgot your password?</Message.Header>
					<p><Link to='/password/reset/'>Click here</Link> to reset it.</p>
				</Message>
			</Form>
	);
};

export function AuthWiki(props) {
	const { user } = props;

	return (
		<Segment compact padded>
			<Header size='medium'>
				<Image src={'/wikilogo.png'} />
				Protospace Wiki
			</Header>

			<p>would like to request Spaceport authentication.</p>

			<p>URL: <a href='https://wiki.protospace.ca/Welcome_to_Protospace' target='_blank' rel='noopener noreferrer'>wiki.protospace.ca</a></p>

			<AuthForm user={user}>
				<Header size='small'>Success!</Header>
				<p>You can now log into the Wiki:</p>
				<p>
					Username: {user.username}<br/>
					Password: [this Spaceport password]
				</p>
				<p><a href='https://wiki.protospace.ca/index.php?title=Special:UserLogin&returnto=Welcome+to+Protospace' rel='noopener noreferrer'>Protospace Wiki</a></p>
			</AuthForm>
		</Segment>
	);
}

export function AuthDiscourse(props) {
	const { user } = props;

	return (
		<Segment compact padded>
			<Header size='medium'>
				<Image src={'/discourselogo.png'} />
				Protospace Discourse
			</Header>

			<p>would like to request Spaceport authentication.</p>

			<p>URL: <a href='https://forum.protospace.ca' target='_blank' rel='noopener noreferrer'>forum.protospace.ca</a></p>

			<AuthForm user={user}>
				<Header size='small'>Success!</Header>
				<p>You can now log into the Discourse:</p>
				<p>
					Username: {user.member.discourse_username || user.username}<br/>
					Password: [this Spaceport password]
				</p>
				<p><a href='https://forum.protospace.ca' rel='noopener noreferrer'>Protospace Discourse</a></p>
			</AuthForm>
		</Segment>
	);
}

export function Auth(props) {
	const { user } = props;

	return (
		<Container>
			<Header size='large'>Spaceport Auth</Header>

			<p>Use this page to link different applications to your Spaceport account.</p>

			<Route path='/auth/wiki'>
				<AuthWiki user={user} />
			</Route>

			<Route path='/auth/discourse'>
				<AuthDiscourse user={user} />
			</Route>
		</Container>
	);
}
