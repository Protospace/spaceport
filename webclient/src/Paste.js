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
				maxlength={20000}
				rows={20}
				{...makeProps('paste')}
			/>

			{!!token &&<Form.Button loading={loading} error={error.non_field_errors}>
				Submit
			</Form.Button>}
			{success && <div>Success!</div>}
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
