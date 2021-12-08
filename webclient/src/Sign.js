import React, { useState, useEffect, useReducer, useContext } from 'react';
import { BrowserRouter as Router, Switch, Route, Link, useParams, useHistory } from 'react-router-dom';
import { Button, Container, Checkbox, Dimmer, Divider, Dropdown, Form, Grid, Header, Icon, Image, Menu, Message, Segment, Table } from 'semantic-ui-react';
import { apiUrl, statusColor, BasicTable, staticUrl, requester } from './utils.js';
import { NotFound } from './Misc.js';

export function SignForm(props) {
	const { token } = props;
	const [error, setError] = useState({});
	const [sign, setSign] = useState('');
	const [loading, setLoading] = useState(false);
	const [success, setSuccess] = useState(false);

	const handleValues = (e, v) => setSign(v.value);
	const handleChange = (e) => handleValues(e, e.currentTarget);

	const handleSubmit = (e) => {
		if (loading) return;
		setLoading(true);
		const data = {sign: sign};
		requester('/stats/sign/', 'POST', token, data)
		.then(res => {
			setLoading(false);
			setSuccess(true);
			setError({});
			setSign('');
		})
		.catch(err => {
			setLoading(false);
			console.log(err);
			setError(err.data);
		});
	};

	return (
		<Form onSubmit={handleSubmit}>
			<p>Send a message to the sign:</p>

			<Form.Input
				name='sign'
				onChange={handleChange}
				value={sign}
				error={error.sign}
			/>

			<Form.Button loading={loading} error={error.non_field_errors}>
				Submit
			</Form.Button>
			{success && <div>Success!</div>}
		</Form>
	);
};

export function Sign(props) {
	const { token } = props;

	return (
		<Container>
			<Header size='large'>Protospace Sign</Header>

			<SignForm token={token} />
		</Container>
	);
};
