import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import './light.css';
import { Container, Checkbox, Form, Header, Segment } from 'semantic-ui-react';
import * as Datetime from 'react-datetime';
import 'react-datetime/css/react-datetime.css';
import moment from 'moment';
import { requester } from './utils.js';
import { TransactionList, TransactionEditor } from './Transactions.js';

export function AdminReportedTransactions(props) {
	const { token } = props;
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
		<div>
			{!error ?
				transactions ?
					<div>
						<TransactionList transactions={transactions} />
					</div>
				:
					<p>Loading...</p>
			:
				<p>Error loading.</p>
			}
		</div>
	);
};

let transactionsCache = false;
let excludePayPalCache = false;

export function AdminHistoricalTransactions(props) {
	const { token } = props;
	const [input, setInput] = useState({ month: moment() });
	const [transactions, setTransactions] = useState(transactionsCache);
	const [excludePayPal, setExcludePayPal] = useState(excludePayPalCache);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState(false);

	const handleDatetime = (v) => setInput({ ...input, month: v });

	const handleExcludePayPal = (e, v) => {
		setExcludePayPal(v.checked);
		excludePayPalCache = v.checked;
	};

	const handleSubmit = (e) => {
		if (loading) return;
		setLoading(true);
		const month = input.month.format('YYYY-MM');
		requester('/transactions/?month=' + month, 'GET', token)
		.then(res => {
			setLoading(false);
			setError(false);
			setTransactions(res.results);
			transactionsCache = res.results;
		})
		.catch(err => {
			setLoading(false);
			console.log(err);
			setError(true);
		});
	};

	return (
		<div>
			<Form onSubmit={handleSubmit}>
				<label>Month</label>
				<Form.Group>
					<Form.Field>
						<Datetime
							dateFormat='YYYY-MM'
							timeFormat={false}
							value={input.month}
							onChange={handleDatetime}
						/>
					</Form.Field>

					<Form.Button loading={loading}>
						Submit
					</Form.Button>
				</Form.Group>
			</Form>

			{!error ?
				transactions && <div>
					<p>Found {transactions.length} transactions.</p>
					{!!transactions.length &&
						<Header size='small'>{moment(transactions[0].date, 'YYYY-MM-DD').format('MMMM YYYY')} Transactions</Header>
					}

					<Checkbox
						label='Exclude PayPal'
						onChange={handleExcludePayPal}
						checked={excludePayPal}
					/>

					<TransactionList transactions={transactions.filter(x => !excludePayPal || x.account_type !== 'PayPal')} />
				</div>
			:
				<p>Error loading transactions.</p>
			}
		</div>
	);
};

export function AdminAddTransaction(props) {
	const { token } = props;
	const [input, setInput] = useState({ date: moment().format('YYYY-MM-DD'), info_source: 'Web' });
	const [error, setError] = useState(false);
	const [loading, setLoading] = useState(false);
	const [success, setSuccess] = useState(false);

	const handleSubmit = (e) => {
		if (loading) return;
		setLoading(true);
		setSuccess(false);
		requester('/transactions/', 'POST', token, input)
		.then(res => {
			setSuccess(res.id);
			setInput({});
			setLoading(false);
			setError(false);
		})
		.catch(err => {
			setLoading(false);
			console.log(err);
			setError(err.data);
		});
	};

	return (
		<Form onSubmit={handleSubmit}>
			<TransactionEditor {...props} input={input} setInput={setInput} error={error} />

			<Form.Button loading={loading} error={error.non_field_errors}>
				Submit
			</Form.Button>
			{success && <p>Added! <Link to={'/transactions/'+success}>View the transaction.</Link></p>}
		</Form>
	);
};

export function AdminTransactions(props) {
	return (
		<Container>
			<Header size='large'>Admin Transactions</Header>

			<Segment padded>
				<Header size='medium'>Add a Transaction</Header>
				<AdminAddTransaction {...props} />
			</Segment>

			<Header size='medium'>Reported</Header>
			<AdminReportedTransactions {...props} />

			<Header size='medium'>Historical</Header>
			<AdminHistoricalTransactions {...props} />
		</Container>
	);
}

export function AdminMemberTransactions(props) {
	const { result } = props;
	const transactions = result.transactions;

	return (
		<div>
			<Header size='medium'>Member Transactions</Header>

			<Link to='/admintrans'>Add a transaction</Link>

			<Header size='small'>Current Transactions</Header>

			{transactions.length ?
				<TransactionList noMember transactions={transactions} />
			:
				<p>None</p>
			}

		</div>
	);
};
