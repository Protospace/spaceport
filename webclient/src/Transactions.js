import React, { useState, useEffect, useRef } from 'react';
import { Link, useParams } from 'react-router-dom';
import moment from 'moment-timezone';
import ReactToPrint from 'react-to-print';
import './light.css';
import { Button, Container, Form, Grid, Header, Message, Segment, Table } from 'semantic-ui-react';
import { MembersDropdown } from './Members.js';
import { isAdmin, BasicTable, requester, useIsMobile } from './utils.js';
import { NotFound } from './Misc.js';

export function TransactionEditor(props) {
	const { token, input, setInput, error } = props;

	const [prevInput] = useState(input);
	const [prevTransactions, setPrevTransactions] = useState([]);
	const [txError, setTxError] = useState(false);

	const handleValues = (e, v) => setInput({ ...input, [v.name]: v.value });
	const handleChange = (e) => handleValues(e, e.currentTarget);

	const checkPrevTransactions = (member_id, date) => {
		console.log(member_id, date);

		const isValidISODate = /^\d{4}-\d{2}-\d{2}$/.test(date);

		if (!member_id || !isValidISODate) {
			return;
		}

		console.log('Checking previous transactions:', member_id, date);

		requester('/transactions/?date=' + date + '&member_id=' + member_id, 'GET', token)
		.then(res => {
			setTxError(false);
			setPrevTransactions(res.results);
		})
		.catch(err => {
			console.log(err);
			setTxError(true);
		});
	};

	const handleMemberValue = (e, v) => {
		checkPrevTransactions(v.value, input.date);
		handleValues(e, v);
	};

	const handleDateValue = (e) => {
		checkPrevTransactions(input.member_id, e.currentTarget.value);
		handleChange(e);
	};

	const makeProps = (name) => ({
		name: name,
		onChange: handleChange,
		value: input[name] || '',
		error: error[name],
	});

	const accountOptions = [
		{ key: '0', text: 'Cash', value: 'Cash' },
		{ key: '1', text: 'Interac e-Transfer', value: 'Interac' },
		{ key: '2', text: 'Square', value: 'Square Pmt' },
		//{ key: '3', text: 'Dream Payments (Debit/Credit)', value: 'Dream Pmt' },
		{ key: '4', text: 'Cheque', value: 'TD Chequing' },
		//{ key: '5', text: 'Member Balance / Protocash', value: 'Member' },
		{ key: '6', text: 'Membership Adjustment / Clearing', value: 'Clearing' },
		{ key: '7', text: 'PayPal', value: 'PayPal' },
		{ key: '8', text: 'Protocoin', value: 'Protocoin' },
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
		{ key: '1', text: 'Course Fee', value: 'OnAcct' },
		{ key: '2', text: 'Snacks / Pop / Coffee', value: 'Snacks' },
		{ key: '3', text: 'Donation (Explain in Memo)', value: 'Donation' },
		{ key: '4', text: 'Consumables (Explain in Memo)', value: 'Consumables' },
		{ key: '5', text: 'Purchase of Locker / Materials / Stock', value: 'Purchases' },
		{ key: '6', text: 'Purchase of Protocoin', value: 'Exchange' },
		{ key: '7', text: 'Reimbursement (Not for Refunds)', value: 'Reimburse' },
		{ key: '8', text: 'Other (Explain in Memo)', value: 'Other' },
	];

	return (
		<div className='transaction-editor'>
			<Form.Group widths='equal'>
				<Form.Field error={error.member_id}>
					<label>Member (search)</label>
					<MembersDropdown
						token={token}
						{...makeProps('member_id')}
						onChange={handleMemberValue}
						initial={input.member_name}
					/>
				</Form.Field>

				<Form.Input
					label='Transaction Date (YYYY-MM-DD)'
					fluid
					{...makeProps('date')}
					onChange={handleDateValue}
				/>
			</Form.Group>

			{!!prevTransactions.length && <Form.Field>
				<label>Potential Duplicates</label>
				<p>These are from the same member, same day.</p>
				<TransactionList noMember noDate addRef transactions={prevTransactions} />
			</Form.Field>}

			{txError && <p>Error checking for duplicate transactions.</p>}

			<Form.Group widths='equal'>
				<Form.Select
					label='Payment Method'
					fluid
					options={accountOptions}
					{...makeProps('account_type')}
					onChange={handleValues}
				/>

				{input.account_type && (input.account_type === 'Protocoin' ?
					<Form.Input
						label='Protocoin Delta (+/-)'
						fluid
						{...makeProps('protocoin')}
					/>
				:
					<Form.Input
						label='Amount ($)'
						fluid
						{...makeProps('amount')}
					/>
				)}
			</Form.Group>

			{input?.account_type !== prevInput?.account_type && input?.account_type === 'PayPal' &&
				<Message visible warning>
					<Message.Header>Are you sure?</Message.Header>
					<p>PayPal transactions are automatic. Double check there's no duplicate. They may take 24h to appear. Also check Space > Transactions > Reported.</p>
				</Message>
			}

			{input?.account_type !== prevInput?.account_type && input?.account_type === 'Protocoin' &&
				<Message visible warning>
					<Message.Header>Are you sure?</Message.Header>
					<p>Protocoin spending transactions are automatic. Do you want the "Purchase of Protocoin" category below?</p>
					{input.protocoin > 0 && <p>Also, the value should be a <b>negative</b> number if they are spending Protocoin.</p>}
				</Message>
			}

			<Form.Group widths='equal'>
				<Form.Select
					label='Category'
					fluid
					options={categoryOptions}
					{...makeProps('category')}
					onChange={handleValues}
				/>

				{input.category === 'Membership' &&
					<Form.Input
						label='Membership Months (+/-)'
						fluid
						{...makeProps('number_of_membership_months')}
					/>
				}

				{input.category === 'Exchange' &&
					<Form.Input
						label='Protocoin Purchased'
						fluid
						{...makeProps('amount')}  // trick the user
					/>
				}
			</Form.Group>

			<Form.Group widths='equal'>
				<Form.Input
					label='Reference Number'
					fluid
					{...makeProps('reference_number')}
				/>

				<Form.Input
					label='Memo / Notes'
					fluid
					{...makeProps('memo')}
				/>
			</Form.Group>
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


export function TransactionList(props) {
	const { transactions, noMember, noCategory, noDate, addRef } = props;
	const isMobile = useIsMobile();

	return (
		<Table basic='very'>
			{!isMobile && <Table.Header>
				<Table.Row>
					{!noDate && <Table.HeaderCell>Date</Table.HeaderCell>}
					{!noMember && <Table.HeaderCell>Member</Table.HeaderCell>}
					<Table.HeaderCell>Amount</Table.HeaderCell>
					<Table.HeaderCell>Method</Table.HeaderCell>
					{!noCategory && <Table.HeaderCell>Category</Table.HeaderCell>}
					{!!addRef && <Table.HeaderCell>Reference</Table.HeaderCell>}
					<Table.HeaderCell>Memo</Table.HeaderCell>
				</Table.Row>
			</Table.Header>}

			<Table.Body>
				{transactions.length ?
					transactions.map(x =>
						<Table.Row key={x.id}>
							{!noDate && <Table.Cell style={{ minWidth: '8rem' }}>
								<Link to={'/transactions/'+x.id}>{moment(x.date).format('ll')}</Link>
							</Table.Cell>}

							{!noMember && <Table.Cell>
								{x.member_id ?
									<Link to={'/members/'+x.member_id}>
										{x.member_name}
									</Link>
								:
									x.member_name
								}
							</Table.Cell>}
							<Table.Cell style={{ minWidth: '8rem' }}>{isMobile && 'Amount: '}{x.protocoin !== '0.00' ? '₱ ' + x.protocoin : '$ ' + x.amount}</Table.Cell>
							<Table.Cell>{isMobile && 'Method: '}{x.account_type}</Table.Cell>
							{!noCategory && <Table.Cell>{isMobile && 'Category: '}{x.category}</Table.Cell>}
							{!!addRef && <Table.Cell>{isMobile && 'Reference: '}{x.reference_number}</Table.Cell>}
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
			<Header size='large'>Your Transactions</Header>

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
						<Table.Cell>$ {transaction.amount}</Table.Cell>
					</Table.Row>
					{transaction.protocoin !== '0.00' && <Table.Row>
						<Table.Cell>Protocoin:</Table.Cell>
						<Table.Cell>₱ {transaction.protocoin}</Table.Cell>
					</Table.Row>}
					<Table.Row>
						<Table.Cell>Category:</Table.Cell>
						<Table.Cell>{transaction.category}</Table.Cell>
					</Table.Row>
					<Table.Row>
						<Table.Cell>Method:</Table.Cell>
						<Table.Cell>{transaction.account_type}</Table.Cell>
					</Table.Row>
					{/* <Table.Row>
						<Table.Cell>Payment Method:</Table.Cell>
						<Table.Cell>{transaction.payment_method}</Table.Cell>
					</Table.Row> */}
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
					<Table.Row>
						<Table.Cell>Recorder:</Table.Cell>
						<Table.Cell>{transaction.recorder || 'System'}</Table.Cell>
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
			<div style={{padding: '1in', background: 'white', width: '100%', height: '100%'}}>
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
	const ownTransaction = user.transactions.find(x => x.id === id);
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
							<Grid.Column width={6}>
								<TransactionTable user={user} transaction={transaction} />

								<div style={{ display: 'none' }}>
									<TransactionPrint ref={printRef} user={user} transaction={transaction} />
								</div>
								<ReactToPrint
									trigger={() => <Button>Print Receipt</Button>}
									content={() => printRef.current}
								/>
							</Grid.Column>

							<Grid.Column width={10}>
								{isAdmin(user) ?
									<Segment padded>
										<EditTransaction transaction={transaction} setTransaction={setTransaction} {...props} />
									</Segment>
								:
									<Segment padded>
										<Header size='medium'>Report Transaction</Header>

										<p>If there's anything wrong with this transaction or it was made in error please email the Protospace Directors:</p>
										<p><a href='mailto:directors@protospace.ca' target='_blank' rel='noopener noreferrer'>directors@protospace.ca</a></p>
										<p>Please include a link to this transaction and any relevant details.</p>
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

