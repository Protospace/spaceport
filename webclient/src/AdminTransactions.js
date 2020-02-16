import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Switch, Route, Link, useParams, useHistory } from 'react-router-dom';
import './light.css';
import { Button, Container, Checkbox, Dimmer, Divider, Dropdown, Form, Grid, Header, Icon, Image, Menu, Message, Segment, Table } from 'semantic-ui-react';
import moment from 'moment';
import { statusColor, BasicTable, staticUrl, requester } from './utils.js';
import { TransactionList, TransactionEditor } from './Transactions.js';
import { NotFound } from './Misc.js';

export function AdminReportedTransactions(props) {
	const { token, user } = props;
	const [transactions, setTransactions] = useState(false);
	const [error, setError] = useState(false);

	useEffect(() => {
		requester('/transactions/', 'GET', token)
		.then(res => {
			setTransactions(res.results);
			setError(false);
		})
		.catch(err => {
			console.log(err);
			setError(true);
		});
	}, []);

	return (
		<Container>
			<Header size='large'>Reported Transactions</Header>

			{!error ?
				transactions ?
					<div>
						<TransactionList transactions={transactions} />
					</div>
				:
					<p>Loading...</p>
			:
				<NotFound />
			}

		</Container>
	);
};

export function AdminTransactions(props) {
	const { token, result, refreshResult } = props;
	const transactions = result.transactions;
	const [open, setOpen] = useState(false);
	const [input, setInput] = useState({ date: moment().format('YYYY-MM-DD'), info_source: 'Web' });
	const [error, setError] = useState(false);
	const [loading, setLoading] = useState(false);
	const [success, setSuccess] = useState(false);
	const { id } = useParams();

	const handleSubmit = (e) => {
		if (loading) return;
		setLoading(true);
		setSuccess(false);
		const data = { ...input, member_id: id };
		requester('/transactions/', 'POST', token, data)
		.then(res => {
			setSuccess(res.id);
			setInput({});
			setLoading(false);
			setError(false);
			refreshResult();
		})
		.catch(err => {
			setLoading(false);
			console.log(err);
			setError(err.data);
		});
	};

	return (
		<div>
			<Header size='medium'>Edit Member Transactions</Header>

			<Form onSubmit={handleSubmit}>
				<Header size='small'>Add a Transaction</Header>

				<TransactionEditor noMemberSearch input={input} setInput={setInput} error={error} />

				<Form.Button loading={loading} error={error.non_field_errors}>
					Submit
				</Form.Button>
				{success && <p>Added! <Link to={'/transactions/'+success}>View the transaction.</Link></p>}
			</Form>

			<Header size='small'>Current Transactions</Header>

			{transactions.length ?
				open ?
					<TransactionList transactions={transactions} />
				:
					<Button onClick={() => setOpen(true)}>
						View / Edit Transactions
					</Button>
			:
				<p>None</p>
			}

		</div>
	);
};
