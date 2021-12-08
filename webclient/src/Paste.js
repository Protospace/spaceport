import React, { useState, useEffect, useReducer, useContext } from 'react';
import { BrowserRouter as Router, Switch, Route, Link, useParams, useHistory } from 'react-router-dom';
import { Button, Container, Checkbox, Dimmer, Divider, Dropdown, Form, Grid, Header, Icon, Image, Menu, Message, Segment, Table } from 'semantic-ui-react';
import { apiUrl, statusColor, BasicTable, staticUrl, requester } from './utils.js';
import { NotFound } from './Misc.js';

function PasteForm(props) {
	const { token, input, setInput } = props;
	const [error, setError] = useState({});
	const [loading, setLoading] = useState(false);
	const [success, setSuccess] = useState(false);

	const handleValues = (e, v) => setInput({ ...input, [v.name]: v.value });
	const handleChange = (e) => handleValues(e, e.currentTarget);

	const handleSubmit = (e) => {
		if (loading) return;
		setLoading(true);
		requester('/paste/', 'POST', token, input)
		.then(res => {
			setLoading(false);
			setSuccess(true);
			setError({});
			setInput(res);
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
		value: input[name] || '',
		error: error[name],
	});

	return (
		<Form onSubmit={handleSubmit}>
			<Form.TextArea
				maxLength={20000}
				rows={15}
				{...makeProps('paste')}
			/>

			{!!token &&<Form.Button loading={loading} error={error.non_field_errors}>
				Submit
			</Form.Button>}
			{success && <div>Success!</div>}
		</Form>
	);
};

function LabelForm(props) {
	const [error, setError] = useState(false);
	const [input, setInput] = useState({ id: '107', size: '2' });
	const [label, setLabel] = useState(false);
	const [loading, setLoading] = useState(false);
	const [success, setSuccess] = useState(false);

	const handleValues = (e, v) => setInput({ ...input, [v.name]: v.value });
	const handleChange = (e) => handleValues(e, e.currentTarget);

	const handleSubmit = (e) => {
		if (loading) return;
		setLoading(true);
		fetch('https://labels.protospace.ca/?' + new URLSearchParams(input))
		.then(res => {
			if (res.ok) {
				return res.blob();
			} else {
				return res.text().then(text => {throw new Error(text)});
			}
		})
		.then(res => {
			setLoading(false);
			setSuccess(true);
			setError(false);
			const imageObjectURL = URL.createObjectURL(res);
			setLabel(imageObjectURL);
		})
		.catch(err => {
			setLabel(false);
			setLoading(false);
			console.log(err);
			setError(err);
		});
	};

	const makeProps = (name) => ({
		name: name,
		onChange: handleChange,
		value: input[name] || '',
	});

	const sizeOptions = [
		{ key: '0', text: '1.0', value: '1' },
		{ key: '1', text: '1.5', value: '1.5' },
		{ key: '2', text: '2.0', value: '2' },
		{ key: '3', text: '2.5', value: '2.5' },
		{ key: '4', text: '3.0', value: '3' },
		{ key: '5', text: '3.5', value: '3.5' },
		{ key: '6', text: '4.0', value: '4' },
	];

	return (
		<Form onSubmit={handleSubmit} error={!!error}>
			<Form.Group widths='equal'>
				<Form.Input
					fluid
					label='Wiki ID #'
					{...makeProps('id')}
				/>

				<Form.Select
					fluid
					label='Size'
					options={sizeOptions}
					{...makeProps('size')}
					onChange={handleValues}
				/>
			</Form.Group>

			<Message
				error
				header='Label Error'
				content={error.message}
			/>

			<Form.Button loading={loading}>
				Submit
			</Form.Button>

			{label && <img src={label} />}
		</Form>
	);
};

let pasteCache = 'Loading...';

export function Paste(props) {
	const { token } = props;
	const [input, setInput] = useState({ paste: pasteCache });
	const [refreshCount, refreshPaste] = useReducer(x => x + 1, 0);

	useEffect(() => {
		requester('/paste/', 'GET', token)
		.then(res => {
			setInput({ paste: res.paste });
			pasteCache = res.paste;
		})
		.catch(err => {
			console.log(err);
		});
	}, [refreshCount]);

	return (
		<Container>
			<Header size='large'>Label Generator</Header>

			<p>Use this to generate QR code labels for tools at Protospace.</p>

			<p>Choose a tool from here: <a href='https://wiki.protospace.ca/Category:Tools' target='_blank'>https://wiki.protospace.ca/Category:Tools</a></p>

			<LabelForm />

			<Header size='large'>Transporter</Header>

			<p>
				Use this to quickly share info with people across devices.
				For example: your LAN party server IP address, a config file,
				a public key, an Arduino sketch, or a URL.
			</p>

			<p>
				Members can write, anyone can read. Everyone shares what's below.
			</p>

			<p>
				<Button onClick={refreshPaste}>
					Refresh
				</Button>
			</p>

			<PasteForm {...props} input={input} setInput={setInput} />
		</Container>
	);
};
