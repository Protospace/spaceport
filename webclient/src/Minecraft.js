import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import { Container, Form, Grid, Header, Label, Message } from 'semantic-ui-react';
import { requester } from './utils.js';

export function Minecraft(props) {
	const { token } = props;
	const { id } = useParams();
	const [success, setSuccess] = useState(false);
	const [result, setResult] = useState('');
	const [input, setInput] = useState({name: id});
	const [error, setError] = useState({});
	const [loading, setLoading] = useState(false);

	const handleValues = (e, v) => setInput({ ...input, [v.name]: v.value });
	const handleChange = (e) => handleValues(e, e.currentTarget);

	const handleSubmit = (e) => {
		e.preventDefault();
		if (loading) return;
		setLoading(true);
		setSuccess(false);
		setError({});
		requester('/minecraft/whitelist/', 'POST', token, input)
		.then(res => {
			setLoading(false);
			setSuccess(true);
			setResult(res.result || 'Command completed.');
		})
		.catch(err => {
			setLoading(false);
			console.log(err);
			setError(err.data || {non_field_errors: ['Could not update the player.']});
		});
	};

	const makeProps = (name) => ({
		name: name,
		onChange: handleChange,
		value: input[name] || '',
		error: error[name],
	});

	return (
		<Container>
			<Grid stackable columns={2}>
				<Grid.Column>
					<Header size='large'>Protospace Minecraft</Header>

					<p>Use this form to whitelist players on the Protospace Minecraft server.</p>

					<p>Please connect to the server first.</p>

					<p>Server info: <a href='https://wiki.protospace.ca/Minecraft_Server' target='_blank'>https://wiki.protospace.ca/Minecraft_Server</a></p>

					<Form onSubmit={handleSubmit}>
						<Form.Input
							label='Player name'
							autoComplete='off'
							required
							{...makeProps('name')}
							maxLength={16}
						/>

						<Form.Group grouped>
							<label>Whose account is this?</label>
							<Form.Radio
								label='My account'
								name='my_account'
								value={true}
								checked={input.my_account === true}
								onChange={handleValues}
								error={!!error.my_account}
							/>
							<Form.Radio
								label='Someone I know'
								name='my_account'
								value={false}
								checked={input.my_account === false}
								onChange={handleValues}
								error={!!error.my_account}
							/>
						</Form.Group>

						<Form.Button loading={loading} disabled={input.my_account === undefined} error={error.non_field_errors}>
							Submit
						</Form.Button>
						{success && <div>Success! {result}.</div>}
					</Form>
				</Grid.Column>
			</Grid>
		</Container>
	);
};

