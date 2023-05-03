import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import './light.css';
import { Container, Checkbox, Form, Header, Segment, Table } from 'semantic-ui-react';
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
let summaryCache = false;

export function AdminHistoricalTransactions(props) {
	const { token } = props;
	const [input, setInput] = useState({ month: moment() });
	const [transactions, setTransactions] = useState(transactionsCache);
	const [summary, setSummary] = useState(summaryCache);
	const [excludePayPal, setExcludePayPal] = useState(false);
	const [excludeSnacks, setExcludeSnacks] = useState(true);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState(false);

	const handleDatetime = (v) => setInput({ ...input, month: v });

	const makeRequest = () => {
		if (loading) return;
		setLoading(true);
		const month = input.month.format('YYYY-MM');
		requester('/transactions/?month=' + month + '&exclude_paypal=' + excludePayPal + '&exclude_snacks=' + excludeSnacks, 'GET', token)
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

		requester('/transactions/summary/?month=' + month, 'GET', token)
		.then(res => {
			setLoading(false);
			setError(false);
			setSummary(res);
			summaryCache = res;
		})
		.catch(err => {
			setLoading(false);
			console.log(err);
			setError(true);
		});
	};

	const handleSubmit = (e) => {
		makeRequest();
	};

	const handleExcludePayPal = (e, v) => {
		setExcludePayPal(v.checked);
	};

	const handleExcludeSnacks = (e, v) => {
		setExcludeSnacks(v.checked);
	};

	useEffect(() => {
		makeRequest();
	}, [excludePayPal, excludeSnacks]);

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
			{transactions && <p>Found {transactions.length} transactions.</p>}

			{!error ?
				summary && <div>
					<Header size='small'>Summary</Header>

					<Table basic='very'>
						<Table.Header>
							<Table.Row>
								<Table.HeaderCell>Category</Table.HeaderCell>
								<Table.HeaderCell>Dollar</Table.HeaderCell>
								<Table.HeaderCell>Protocoin</Table.HeaderCell>
							</Table.Row>
						</Table.Header>

						<Table.Body>
							{summary.map(x =>
								<Table.Row key={x.category}>
									<Table.Cell>{x.category}</Table.Cell>
									<Table.Cell>{'$ ' + x.dollar.toFixed(2)}</Table.Cell>
									<Table.Cell>{'₱ ' + x.protocoin.toFixed(2)}</Table.Cell>
								</Table.Row>
							)}
						</Table.Body>
					</Table>
				</div>
			:
				<p>Error loading summary.</p>
			}

			<p/>

			{!error ?
				transactions && <div>
					{!!transactions.length &&
						<Header size='small'>{moment(transactions[0].date, 'YYYY-MM-DD').format('MMMM YYYY')} Transactions</Header>
					}

					<Checkbox
						className='filter-option'
						label='Exclude PayPal'
						onChange={handleExcludePayPal}
						checked={excludePayPal}
					/>

					<Checkbox
						className='filter-option'
						label='Exclude Snacks'
						onChange={handleExcludeSnacks}
						checked={excludeSnacks}
					/>

					<TransactionList transactions={transactions} />
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
