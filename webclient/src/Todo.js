import React, { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Container, Form, Header } from 'semantic-ui-react';
import { requester } from './utils.js';

export function OutOfStock(props) {
	const { token } = props;
	const [error, setError] = useState({});
	const [loading, setLoading] = useState(false);
	const [success, setSuccess] = useState(false);

	const qs = useLocation().search;
	const params = new URLSearchParams(qs);
	const item = params.get('item') || false;

	const handleSubmit = (e) => {
		if (loading) return;
		setLoading(true);
		const data = { item: item };
		requester('/todo/out_of_stock/', 'POST', token, data)
		.then(res => {
			setLoading(false);
			setSuccess(true);
			setError({});
		})
		.catch(err => {
			setLoading(false);
			console.log(err);
			setError(err.data);
		});
	};

	return (
		<Container>
			<Header size='large'>Out of Stock</Header>

			{!!item ?
				<Form onSubmit={handleSubmit}>
					<p>Is Protospace out of <b>{item}</b> stock?</p>

					{success ?
						<p>Thank you!</p>
					:
						<Form.Group widths='equal'>
							<Form.Button loading={loading} error={error.non_field_errors}>
								Yes!
							</Form.Button>
						</Form.Group>
					}
				</Form>
			:
				<p>Error: item missing?</p>
			}

			<p><a href='https://todo.protospace.ca/projects/4/13' target='_blank' rel='noopener noreferrer'>View shopping list</a></p>
		</Container>
	);
};

