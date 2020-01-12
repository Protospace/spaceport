import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Switch, Route, Link, useParams, useHistory } from 'react-router-dom';
import './light.css';
import { Container, Divider, Dropdown, Form, Grid, Header, Icon, Image, Menu, Message, Segment, Table } from 'semantic-ui-react';
import { BasicTable, staticUrl, requester } from './utils.js';
import { LoginForm, SignupForm } from './LoginSignup.js';

function AccountForm(props) {
	const member = props.user.member;
	const [input, setInput] = useState({ ...member, set_details: true });
	const [error, setError] = useState({});
	const [loading, setLoading] = useState(false);
	const history = useHistory();

	const handleValues = (e, v) => setInput({ ...input, [v.name]: v.value });
	const handleUpload = (e, v) => setInput({ ...input, [v.name]: e.target.files[0] });
	const handleChange = (e) => handleValues(e, e.currentTarget);

	const handleSubmit = (e) => {
		setLoading(true);
		requester('/members/' + member.id + '/', 'PATCH', props.token, input)
		.then(res => {
			console.log(res);
			setError({});
			props.setUserCache({...props.user, member: res});
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
		value: input[name],
		error: error[name],
	});

	return (
		<Form onSubmit={handleSubmit}>
			<Header size='medium'>Member Details</Header>

			<Form.Input
				label='First Name'
				{...makeProps('first_name')}
			/>
			<Form.Input
				label='Last Name'
				{...makeProps('last_name')}
			/>
			<Form.Input
				label='Preferred First Name'
				{...makeProps('preferred_name')}
			/>

			<Form.Input
				label='Phone Number (999) 555-1234'
				{...makeProps('phone')}
			/>
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
			<AccountForm {...props} />
		</Container>
	);
};
