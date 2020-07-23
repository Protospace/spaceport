import React, { useState, useEffect, useRef } from 'react';
import { BrowserRouter as Router, Switch, Route, Link, useParams } from 'react-router-dom';
import ReactToPrint from 'react-to-print';
import './light.css';
import { Button, Container, Divider, Dropdown, Form, Grid, Header, Icon, Image, Menu, Message, Segment, Table } from 'semantic-ui-react';
import { MembersDropdown } from './Members.js';
import { isAdmin, BasicTable, requester } from './utils.js';
import { NotFound, PleaseLogin } from './Misc.js';

export function TransactionEditor(props) {
	const { token, input, setInput, error, noMemberSearch } = props;

	const handleValues = (e, v) => setInput({ ...input, [v.name]: v.value });
	const handleUpload = (e, v) => setInput({ ...input, [v.name]: e.target.files[0] });
	const handleChange = (e) => handleValues(e, e.currentTarget);
	const handleCheck = (e, v) => setInput({ ...input, [v.name]: v.checked });

	const makeProps = (name) => ({
		name: name,
		onChange: handleChange,
		value: input[name] || '',
		error: error[name],
	});

	const accountOptions = [
		{ key: '0', text: 'Cash (CAD Lock Box)', value: 'Cash' },
		{ key: '1', text: 'Interac (Email) Transfer (TD)', value: 'Interac' },
		{ key: '2', text: 'Square (Credit)', value: 'Square Pmt' },
		{ key: '3', text: 'Dream Payments (Debit/Credit)', value: 'Dream Pmt' },
		{ key: '4', text: 'Deposit to TD (Not Interac)', value: 'TD Chequing' },
		{ key: '5', text: 'PayPal', value: 'PayPal' },
		{ key: '6', text: 'Member Balance / Protocash', value: 'Member' },
		{ key: '7', text: 'Supense (Clearing)  Acct / Membership Adjustment', value: 'Clearing' },
	];

	const sourceOptions = [
		{ key: '0', text: 'Web (Spaceport)', value: 'Web' },
		{ key: '1', text: 'Database Edit', value: 'DB Edit' },
		{ key: '2', text: 'System', value: 'System' },
		{ key: '3', text: 'Receipt or Statement', value: 'Receipt or Stmt' },
		{ key: '4', text: 'Quicken Import', value: 'Quicken Import' },
		{ key: '5', text: 'PayPal IPN', value: 'PayPal IPN' },
		{ key: '6', text: 'Auto', value: 'Auto' },
		{ key: '7', text: 'Nexus Database Bulk', value: 'Nexus DB Bulk' },
		{ key: '8', text: 'IPN Trigger', value: 'IPN Trigger' },
		{ key: '9', text: 'Intranet Receipt', value: 'Intranet Receipt' },
		{ key: '10', text: 'Automatic', value: 'Automatic' },
		{ key: '11', text: 'Manual', value: 'Manual' },
	];

	const categoryOptions = [
		{ key: '0', text: 'Membership Dues', value: 'Membership' },
		{ key: '1', text: 'Payment On Account (ie. Course Fee)', value: 'OnAcct' },
		{ key: '2', text: 'Snack / Pop / Coffee', value: 'Snacks' },
		{ key: '3', text: 'Donations', value: 'Donation' },
		{ key: '4', text: 'Consumables (Specify which in memo)', value: 'Consumables' },
		{ key: '5', text: 'Purchase of Locker / Goods / Merch / Stock', value: 'Purchases' },
		{ key: '6', text: 'Auction, Garage Sale, Nearly Free Shelf', value: 'Garage Sale' },
		{ key: '7', text: 'Reimbursement (Enter a negative value)', value: 'Reimburse' },
		{ key: '8', text: 'Other (Explain in memo)', value: 'Other' },
	];

	return (
		<div className='transaction-editor'>
			{!noMemberSearch &&<Form.Field error={error.member_id}>
				<label>Member (search)</label>
				<MembersDropdown
					token={token}
					{...makeProps('member_id')}
					onChange={handleValues}
					initial={input.member_name}
				/>
			</Form.Field>}

			<Form.Group widths='equal'>
				<Form.Input
					label='Date'
					fluid
					{...makeProps('date')}
				/>
				<Form.Input
					label='Amount'
					fluid
					{...makeProps('amount')}
				/>
			</Form.Group>

			<Form.Select
				label='Category'
				fluid
				options={categoryOptions}
				{...makeProps('category')}
				onChange={handleValues}
			/>

			<Form.Select
				label='Account'
				fluid
				options={accountOptions}
				{...makeProps('account_type')}
				onChange={handleValues}
			/>

			<Form.Group widths='equal'>
				<Form.Input
					label='Payment Method'
					fluid
					{...makeProps('payment_method')}
				/>
				<Form.Select
					label='Info Source'
					fluid
					options={sourceOptions}
					{...makeProps('info_source')}
					onChange={handleValues}
				/>
			</Form.Group>

			<Form.Group widths='equal'>
				<Form.Input
					label='Reference Number'
					fluid
					{...makeProps('reference_number')}
				/>

				<Form.Input
					label='# Membership Months'
					fluid
					{...makeProps('number_of_membership_months')}
				/>
			</Form.Group>

			<Form.Input
				label='Memo / Notes'
				fluid
				{...makeProps('memo')}
			/>

		</div>
	);
};

function EditTransaction(props) {
	const { transaction, setTransaction, token, refreshUser } = props;
	const [input, setInput] = useState(transaction);
	const [error, setError] = useState(false);
	const [loading, setLoading] = useState(false);
	const [success, setSuccess] = useState(false);
	const { id } = useParams();

	const handleSubmit = (e) => {
		if (loading) return;
		setLoading(true);
		setSuccess(false);
		const data = { ...input, report_type: null, report_memo: '' };
		requester('/transactions/'+id+'/', 'PUT', token, data)
		.then(res => {
			setLoading(false);
			setSuccess(true);
			setError(false);
			setInput(res);
			setTransaction(res);
			if (refreshUser) {
				refreshUser();
			}
		})
		.catch(err => {
			setLoading(false);
			console.log(err);
			setError(err.data);
		});
	};

	return (
		<div>
			<Header size='medium'>Edit Transaction</Header>

			<Form onSubmit={handleSubmit}>
				<TransactionEditor token={token} input={input} setInput={setInput} error={error} />

				<Form.Button loading={loading} error={error.non_field_errors}>
					{transaction.report_type ? 'Save & Unreport' : 'Save'}
				</Form.Button>
				{success && <div>Success!</div>}
			</Form>
		</div>
	);
};

function ReportTransaction(props) {
	const { transaction, setTransaction, token, refreshUser } = props;
	const [input, setInput] = useState(transaction);
	const [error, setError] = useState(false);
	const [loading, setLoading] = useState(false);
	const [success, setSuccess] = useState(false);
	const { id } = useParams();

	const handleValues = (e, v) => setInput({ ...input, [v.name]: v.value });
	const handleUpload = (e, v) => setInput({ ...input, [v.name]: e.target.files[0] });
	const handleChange = (e) => handleValues(e, e.currentTarget);
	const handleCheck = (e, v) => setInput({ ...input, [v.name]: v.checked });

	const handleSubmit = (e) => {
		if (loading) return;
		setLoading(true);
		setSuccess(false);
		requester('/transactions/'+id+'/report/', 'POST', token, input)
		.then(res => {
			setLoading(false);
			setSuccess(true);
			setError(false);
			if (refreshUser) {
				refreshUser();
			}
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
		<div>
			<Header size='medium'>Report Transaction</Header>

			<p>If this transaction was made in error or there is anything incorrect about it, please report it using this form.</p>
			<p>A staff member will review the report as soon as possible.</p>
			<p>Follow up with <a href='mailto:directors@protospace.ca' target='_blank' rel='noopener noreferrer'>directors@protospace.ca</a>.</p>

			<Form onSubmit={handleSubmit}>
				<Form.TextArea
					label='Reason'
					{...makeProps('report_memo')}
				/>

				<Form.Button loading={loading} error={error.non_field_errors}>
					Submit Report
				</Form.Button>
				{success && <div>Success!</div>}
			</Form>
		</div>
	);
};

export function TransactionList(props) {
	const { transactions, noMember, noCategory } = props;

	return (
		<Table basic='very'>
			<Table.Header>
				<Table.Row>
					<Table.HeaderCell>Date</Table.HeaderCell>
					{!noMember && <Table.HeaderCell>Member</Table.HeaderCell>}
					<Table.HeaderCell>Amount</Table.HeaderCell>
					<Table.HeaderCell>Account</Table.HeaderCell>
					{!noCategory && <Table.HeaderCell>Category</Table.HeaderCell>}
					<Table.HeaderCell>Memo</Table.HeaderCell>
				</Table.Row>
			</Table.Header>

			<Table.Body>
				{transactions.length ?
					transactions.slice().sort((a, b) => a.date < b.date ? 1 : -1).map(x =>
						<Table.Row key={x.id}>
							<Table.Cell>
								<Link to={'/transactions/'+x.id}>{x.date}</Link>
							</Table.Cell>
							{!noMember && <Table.Cell>
								{x.member_id ?
									<Link to={'/members/'+x.member_id}>
										{x.member_name}
									</Link>
								:
									x.member_name
								}
							</Table.Cell>}
							<Table.Cell>${x.amount}</Table.Cell>
							<Table.Cell>{x.account_type}</Table.Cell>
							{!noCategory && <Table.Cell>{x.category}</Table.Cell>}
							<Table.Cell>{x.memo || x.report_memo}</Table.Cell>
						</Table.Row>
					)
				:
					<Table.Row><Table.Cell>None</Table.Cell></Table.Row>
				}
			</Table.Body>
		</Table>
	);
};

export function Transactions(props) {
	const { user } = props;

	return (
		<Container>
			<Header size='large'>Transactions</Header>

			<TransactionList noMember noCategory transactions={user.transactions} />

		</Container>
	);
};

class TransactionTable extends React.Component {
	render() {
		const transaction = this.props.transaction;
		const user = this.props.user;

		return (
			<BasicTable>
				<Table.Body>
					<Table.Row>
						<Table.Cell>Member:</Table.Cell>
						{isAdmin(user) && transaction.member_id ?
							<Table.Cell>
								<Link to={'/members/'+transaction.member_id}>
									{transaction.member_name}
								</Link>
							</Table.Cell>
						:
							<Table.Cell>{transaction.member_name}</Table.Cell>
						}
					</Table.Row>
					<Table.Row>
						<Table.Cell>Number:</Table.Cell>
						<Table.Cell>{transaction.id}</Table.Cell>
					</Table.Row>
					<Table.Row>
						<Table.Cell>Date:</Table.Cell>
						<Table.Cell>{transaction.date}</Table.Cell>
					</Table.Row>
					<Table.Row>
						<Table.Cell>Amount:</Table.Cell>
						<Table.Cell>${transaction.amount}</Table.Cell>
					</Table.Row>
					<Table.Row>
						<Table.Cell>Category:</Table.Cell>
						<Table.Cell>{transaction.category}</Table.Cell>
					</Table.Row>
					<Table.Row>
						<Table.Cell>Account:</Table.Cell>
						<Table.Cell>{transaction.account_type}</Table.Cell>
					</Table.Row>
					<Table.Row>
						<Table.Cell>Payment Method:</Table.Cell>
						<Table.Cell>{transaction.payment_method}</Table.Cell>
					</Table.Row>
					<Table.Row>
						<Table.Cell>Info Source:</Table.Cell>
						<Table.Cell>{transaction.info_source}</Table.Cell>
					</Table.Row>
					<Table.Row>
						<Table.Cell>Reference:</Table.Cell>
						<Table.Cell>{transaction.reference_number}</Table.Cell>
					</Table.Row>
					<Table.Row>
						<Table.Cell>Memo:</Table.Cell>
						<Table.Cell>{transaction.memo}</Table.Cell>
					</Table.Row>

					{!!transaction.report_type && <Table.Row>
						<Table.Cell>Report Type:</Table.Cell>
						<Table.Cell>{transaction.report_type}</Table.Cell>
					</Table.Row>}
					{!!transaction.report_memo && <Table.Row>
						<Table.Cell>Report Memo:</Table.Cell>
						<Table.Cell>{transaction.report_memo}</Table.Cell>
					</Table.Row>}
				</Table.Body>
			</BasicTable>
		);
	}
}

class TransactionPrint extends React.Component {
	render() {
		const transaction = this.props.transaction;
		const user = this.props.user;

		return (
			<div style={{padding: '1in'}}>
				<Header size='large'>Protospace Transaction Receipt</Header>
				<p>Calgary Protospace Ltd.</p>
				<p>Bay 108, 1530 - 27th Ave NE<br />Calgary, AB  T2E 7S6<br />protospace.ca</p>
				<TransactionTable user={user} transaction={transaction} />
				<p>Thank you!</p>
			</div>
		);
	}
}

export function TransactionDetail(props) {
	const { token, user } = props;
	const { id } = useParams();
	const ownTransaction = user.transactions.find(x => x.id == id);
	const [transaction, setTransaction] = useState(ownTransaction || false);
	const [error, setError] = useState(false);
	const printRef = useRef();

	useEffect(() => {
		requester('/transactions/'+id+'/', 'GET', token)
		.then(res => {
			setTransaction(res);
			setError(false);
		})
		.catch(err => {
			console.log(err);
			setError(true);
		});
	}, [ownTransaction]);

	return (
		<Container>
			{!error ?
				transaction ?
					<div>
						<Header size='large'>Transaction Receipt</Header>

						<Grid stackable columns={2}>
							<Grid.Column>
								<TransactionTable user={user} transaction={transaction} />

								<div style={{ display: 'none' }}>
									<TransactionPrint ref={printRef} user={user} transaction={transaction} />
								</div>
								<ReactToPrint
									trigger={() => <Button>Print Receipt</Button>}
									content={() => printRef.current}
								/>
							</Grid.Column>

							<Grid.Column>
								{isAdmin(user) ?
									<Segment padded>
										<EditTransaction transaction={transaction} setTransaction={setTransaction} {...props} />
									</Segment>
								:
									<Segment padded>
										<ReportTransaction transaction={transaction} setTransaction={setTransaction} {...props} />
									</Segment>
								}
							</Grid.Column>
						</Grid>

					</div>
				:
					<p>Loading...</p>
			:
				<NotFound />
			}
		</Container>
	);
};

