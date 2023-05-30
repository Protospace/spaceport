import React, { useState, useEffect } from 'react';
import { Link, useParams, useHistory } from 'react-router-dom';
import './light.css';
import { MembersDropdown } from './Members.js';
import { isAdmin, BasicTable, requester } from './utils.js';
import { Button, Container, Form, Grid, Header, Message, Segment, Table } from 'semantic-ui-react';

export function StorageEditor(props) {
	const { token, input, setInput, error } = props;

	const handleValues = (e, v) => setInput({ ...input, [v.name]: v.value });
	const handleChange = (e) => handleValues(e, e.currentTarget);

	const makeProps = (name) => ({
		name: name,
		onChange: handleChange,
		value: input[name] || '',
		error: error[name],
	});

	const locationOptions = [
		{ key: '0', text: 'Member Shelves', value: 'member_shelves' },
		{ key: '1', text: 'Lockers', value: 'lockers' },
		{ key: '2', text: 'Large Project Storage', value: 'large_project_storage' },
	];

	return (
		<div className='transaction-editor'>
			<Form.Field error={error.member_id}>
				<label>Owner (search)</label>
				<MembersDropdown
					token={token}
					{...makeProps('member_id')}
					onChange={handleValues}
					initial={input.member_name}
					autofocus={!input.member_name}
				/>
			</Form.Field>

			<Form.Select
				label='Location'
				fluid
				options={locationOptions}
				{...makeProps('location')}
				onChange={handleValues}
			/>

			<Form.Input
				label='Memo'
				fluid
				{...makeProps('memo')}
			/>
		</div>
	);
};

function EditStorage(props) {
	const { storage, setStorage, token, refreshUser } = props;
	const [input, setInput] = useState(storage);
	const [error, setError] = useState(false);
	const [loading, setLoading] = useState(false);
	const [success, setSuccess] = useState(false);
	const { id } = useParams();
	const history = useHistory();

	const handleSubmit = (e) => {
		if (loading) return;
		setLoading(true);
		setSuccess(false);
		const data = { ...input };
		return requester('/storage/'+id+'/', 'PUT', token, data)
		.then(res => {
			setLoading(false);
			setSuccess(true);
			setError(false);
			setInput(res);
			setStorage(res);
		})
		.catch(err => {
			setLoading(false);
			console.log(err);
			setError(err.data);
		});
	};

	const saveAndNext = (e) => {
		e.preventDefault();

		handleSubmit(e)
		.then(res => {
			setStorage(false);
			history.push('/storage/' + (parseInt(id) + 1));
		});
	};

	return (
		<div>
			<Header size='medium'>Edit Storage</Header>

			<Form onSubmit={handleSubmit}>
				<StorageEditor token={token} input={input} setInput={setInput} error={error} />

				<Form.Group widths='equal'>
					<Form.Button loading={loading} error={error.non_field_errors}>
						Save
					</Form.Button>

					<Form.Button floated='right' onClick={saveAndNext} loading={loading} error={error.non_field_errors}>
						Save and edit next
					</Form.Button>
				</Form.Group>
				{success && <div>Success!</div>}
			</Form>
		</div>
	);
};

function StorageTable(props) {
	const { storage, user } = props;

	return (
		<BasicTable>
			<Table.Body>
				<Table.Row>
					<Table.Cell>Shelf ID:</Table.Cell>
					<Table.Cell>{storage.shelf_id}</Table.Cell>
				</Table.Row>
				<Table.Row>
					<Table.Cell>Owner:</Table.Cell>
					{isAdmin(user) && storage.member_id ?
						<Table.Cell>
							<Link to={'/members/'+storage.member_id}>
								{storage.member_name}
							</Link>
						</Table.Cell>
					:
						<Table.Cell>{storage.member_name}</Table.Cell>
					}
				</Table.Row>
				<Table.Row>
					<Table.Cell>Location:</Table.Cell>
					<Table.Cell>{storage.location}</Table.Cell>
				</Table.Row>
				<Table.Row>
					<Table.Cell>Memo:</Table.Cell>
					<Table.Cell>{storage.memo}</Table.Cell>
				</Table.Row>
			</Table.Body>
		</BasicTable>
	);
}

export function StorageDetail(props) {
	const { token, user } = props;
	const [storage, setStorage] = useState(false);
	const [error, setError] = useState(false);
	const { id } = useParams();

	useEffect(() => {
		requester('/storage/' + id + '/', 'GET', token)
		.then(res => {
			setStorage(res);
			setError(false);
		})
		.catch(err => {
			console.log(err);
			setError(true);
		});
	}, [id]);

	return (
		<Container>
			{!error ?
				storage ?
					<div>
						<Header size='large'>Storage Location</Header>

						<Grid stackable columns={2}>
							<Grid.Column width={6}>
								<StorageTable user={user} storage={storage} />
							</Grid.Column>

							<Grid.Column width={10}>
								{isAdmin(user) ?
									<Segment padded>
										<EditStorage storage={storage} setStorage={setStorage} token={token} {...props} />
									</Segment>
								:
									<Segment padded>
										<Header size='medium'>Report Storage</Header>

										<p>If there's anything wrong with this storage location please email the Protospace Directors:</p>
										<p><a href='mailto:directors@protospace.ca' target='_blank' rel='noopener noreferrer'>directors@protospace.ca</a></p>
										<p>Please include a link to this storage location and any relevant details.</p>
									</Segment>
								}
							</Grid.Column>
						</Grid>

					</div>
				:
					<p>Loading...</p>
			:
				<p>Error loading.</p>
			}
		</Container>
	);
};

export function StorageList(props) {
	const { token } = props;
	const [storageList, setStorageList] = useState(false);
	const [error, setError] = useState(false);

	useEffect(() => {
		requester('/storage/', 'GET', token)
		.then(res => {
			setStorageList(res.results);
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
				storageList ?
					storageList.map(x =>
						<p><Link to={'/storage/'+x.id}>{x.shelf_id}</Link> - {!!x.member_id &&
							<Link to={'/members/'+x.member_id}>{x.member_name}</Link>
						}</p>
					)
				:
					<p>Loading...</p>
			:
				<p>Error loading.</p>
			}
		</div>
	);
};
