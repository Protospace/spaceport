import React, { useState } from 'react';
import { Container, Form, Header } from 'semantic-ui-react';
import { requester } from './utils.js';

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
			<p>Send a message to the sign + Vestaboard:</p>

			<Form.Group widths='equal'>
				<Form.Input
					name='sign'
					onChange={handleChange}
					value={sign}
					error={error.sign}
				/>

				<Form.Button loading={loading} error={error.non_field_errors}>
					Submit
				</Form.Button>
			</Form.Group>
			{success && <div>Success!</div>}
		</Form>
	);
};

export function VestaboardForm(props) {
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
		const data = {vestaboard: sign};
		requester('/stats/vestaboard/', 'POST', token, data)
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
			<p>Send a message to the Vestaboard only:</p>

			<Form.Group widths='equal'>
				<Form.Input
					name='sign'
					onChange={handleChange}
					value={sign}
					error={error.sign}
				/>

				<Form.Button loading={loading} error={error.non_field_errors}>
					Submit
				</Form.Button>

			</Form.Group>
			{success && <div>Success!</div>}

			<p style={{marginTop: '-0.5rem'}}>
				Special:
				\w = ▒,
				\r = <span style={{color: 'red'}}>█</span>,
				\o = <span style={{color: 'orange'}}>█</span>,
				\y = <span style={{color: 'yellow'}}>█</span>,
				\g = <span style={{color: 'green'}}>█</span>,
				\b = <span style={{color: 'blue'}}>█</span>,
				\v = <span style={{color: 'violet'}}>█</span>,
				\d = °
			</p>
		</Form>
	);
};


export function Sign(props) {
	const { token } = props;

	return (
		<Container>
			<Header size='large'>Protospace Sign</Header>

			<SignForm token={token} />

			<VestaboardForm token={token} />
		</Container>
	);
};
