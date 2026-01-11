import React, { useState, useEffect, useReducer } from 'react';
import { Link, useParams, useHistory } from 'react-router-dom';
import './light.css';
import moment from 'moment-timezone';
import { MembersDropdown } from './Members.js';
import { statusColor, isAdmin, BasicTable, requester, useIsMobile } from './utils.js';
import { Button, Checkbox, Container, Form, Grid, Header, Icon, Input, Message, Segment, Table } from 'semantic-ui-react';

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

	return (
		<div>
			<Header size='medium'>Edit Storage {storage.shelf_id}</Header>

			<Form onSubmit={handleSubmit}>
				<StorageEditor token={token} input={input} setInput={setInput} error={error} />

				<Form.Group widths='equal'>
					<Form.Button loading={loading} error={error.non_field_errors}>
						Save
					</Form.Button>
				</Form.Group>
				{success && <div>Success!</div>}
			</Form>
		</div>
	);
};

export function ReleaseShelf(props) {
	const { token, user, shelf_id, refreshUser, refreshStorage } = props;
	const member = user.member;
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState(false);
	const [yousure, setYousure] = useState(false);

	const handleRelease = (e) => {
		e.preventDefault();

		if (yousure) {
			setLoading(true);
			const data = {shelf_id: shelf_id};
			requester('/storage/release/', 'POST', token, data)
			.then(res => {
				refreshUser();
				refreshStorage();
			})
			.catch(err => {
				setLoading(false);
				console.log(err);
				setError(err.data);
			});
		} else {
			setYousure(true);
		}
	};

	return (
		<Button
			color='red'
			onClick={handleRelease}
			loading={loading}
		>
			{yousure ? 'You Sure?' : 'Release Shelf'}
		</Button>
	);
}

function StorageTable(props) {
	const { storage, user } = props;

	const locations = {
		member_shelves: 'Member Shelves',
		lockers: 'Lockers',
		large_project_storage: 'Large Project Storage',
		accessible_project_storage: 'Accessible Project Storage',
	};

	return (
		<BasicTable>
			<Table.Body>
				<Table.Row>
					<Table.Cell>Shelf ID:</Table.Cell>
					<Table.Cell>{storage.shelf_id}</Table.Cell>
				</Table.Row>
				<Table.Row>
					<Table.Cell>Owner:</Table.Cell>
					{storage.member_id ?
						<Table.Cell>
							<Link to={'/members/'+storage.member_id}>
								{storage.member_name}
							</Link>
							{storage.member_id == user.member.id &&
								<>
									<p>This shelf belongs to you.</p>
									<p><ReleaseShelf shelf_id={storage.shelf_id} {...props} /></p>
								</>
							}
						</Table.Cell>
					:
						<Table.Cell>None</Table.Cell>
					}
				</Table.Row>
				<Table.Row>
					<Table.Cell>Location:</Table.Cell>
					<Table.Cell>
						{locations[storage.location]}
						{(storage.location === 'member_shelves' || storage.location === 'lockers') && <p>
							Aisle {storage.shelf_id[0]} <br/>
							Column {storage.shelf_id[1]} <br/>
							Row {storage.shelf_id[2]}
						</p>}
						{storage.location === 'accessible_project_storage' && <p>
							By the pinball machine
						</p>}
					</Table.Cell>
				</Table.Row>
				<Table.Row>
					<Table.Cell>Memo:</Table.Cell>
					<Table.Cell>{storage.memo || 'None'}</Table.Cell>
				</Table.Row>
			</Table.Body>
		</BasicTable>
	);
}

export function StorageTakeover(props) {
	const { storage } = props;

	const daysRemaining = 180 - moment().diff(moment(storage.member_paused), 'days');

	return (
		<>
			<p>Shelf owner expired / paused on {storage.member_paused}.</p>
			{daysRemaining >= 1 ?
				<p>Shelf can be taken over in {daysRemaining} more day{daysRemaining == 1 ? '' : 's'}.</p>
			:
				<p>Shelf can be <Link to={'/claimshelf/'+storage.shelf_id}>taken over</Link> now.</p>
			}
		</>
	);
}

export function StorageDetail(props) {
	const { token, user } = props;
	const [storage, setStorage] = useState(false);
	const [refreshCount, refreshStorage] = useReducer(x => x + 1, 0);
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
	}, [id, refreshCount]);

	return (
		<Container>
			{!error ?
				storage ?
					<div>
						<Header size='large'>Storage Location</Header>

						<p><Link to={'/storage'}>View the list of all storage locations.</Link></p>

						<Grid stackable columns={2}>
							<Grid.Column width={6}>
								<StorageTable storage={storage} refreshStorage={refreshStorage} {...props} />

								{storage.member_paused &&
									<StorageTakeover storage={storage} />
								}
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

let storageSearchCache = '';

export function StorageSearch(props) {
	const { setSearch } = props;
	const [input, setInput] = useState(storageSearchCache);

	const handleChange = (event) => {
		const q = event.target.value.toUpperCase();
		setInput(q);
		setSearch(q);
		storageSearchCache = q;
	};

	return (
		<div>
			<Input icon='search'
				placeholder='Search...'
				value={input}
				onChange={handleChange}
				aria-label='search products'
				style={{ marginRight: '0.5rem' }}
				maxLength={3}
			/>

			{input.length ?
				<Button
					content='Clear'
					onClick={() => {
						setInput('');
						setSearch('');
						storageSearchCache = '';
					}}
				/> : ''
			}
		</div>
	);
};

let storageListCache = false;
let showEmptyCache = false;
let showMemodCache = false;
let showServedCache = false;
let showExpiredCache = false;

export function StorageList(props) {
	const { token } = props;
	const [storageList, setStorageList] = useState(storageListCache);
	const [search, setSearch] = useState(storageSearchCache);
	const [showEmpty, setShowEmpty] = useState(showEmptyCache);
	const [showMemod, setShowMemod] = useState(showMemodCache);
	const [showServed, setShowServed] = useState(showServedCache);
	const [showExpired, setShowExpired] = useState(showExpiredCache);
	const [error, setError] = useState(false);
	const isMobile = useIsMobile();

	const storageTypes = {
		member_shelves: 'Shelf',
		lockers: 'Locker',
		large_project_storage: 'Large',
		accessible_project_storage: 'Accessible',
	};

	useEffect(() => {
		requester('/storage/', 'GET', token)
		.then(res => {
			setStorageList(res.results);
			storageListCache = res.results;
			setError(false);
		})
		.catch(err => {
			console.log(err);
			setError(true);
		});
	}, []);

	const filterStorage = (x) => {
		if (search.length && !x.shelf_id.startsWith(search)) {
			return false;
		} else if (showEmpty && x.member_name) {
			return false;
		} else if (showMemod && !x.memo) {
			return false;
		} else if (showServed && !x.memo.toLowerCase().includes('served')) {
			return false;
		} else if (showExpired && !x.member_paused) {
			return false;
		} else {
			return true;
		}
	};

	const sortStorage = (a, b) => {
		if (showExpired) {
			return a.member_paused !== b.member_paused ? a.member_paused < b.member_paused ? -1 : 1 : 0;
		} else {
			return a.shelf_id !== b.shelf_id ? a.shelf_id < b.shelf_id ? -1 : 1 : 0;
		}
	};

	const handleShowEmpty = (e, v) => {
		setShowEmpty(v.checked);
		showEmptyCache = v.checked;
	};

	const handleShowMemod = (e, v) => {
		setShowMemod(v.checked);
		showMemodCache = v.checked;
	};

	const handleShowServed = (e, v) => {
		setShowServed(v.checked);
		showServedCache = v.checked;
	};

	const handleShowExpired = (e, v) => {
		setShowExpired(v.checked);
		showExpiredCache = v.checked;
	};

	const numResults = storageList ? storageList.filter(filterStorage).length : 0;

	return (
		<div>
			<p>
				<StorageSearch setSearch={setSearch} />
			</p>

			<p>
				<Checkbox
					className='filter-option'
					label='Show Empty'
					onChange={handleShowEmpty}
					checked={showEmpty}
				/>

				<Checkbox
					className='filter-option'
					label={'Show Memo\'d'}
					onChange={handleShowMemod}
					checked={showMemod}
				/>

				<Checkbox
					className='filter-option'
					label='Show Served'
					onChange={handleShowServed}
					checked={showServed}
				/>

				<Checkbox
					className='filter-option'
					label='Show Expired'
					onChange={handleShowExpired}
					checked={showExpired}
				/>
			</p>

			{!error ?
				storageList ?
					<>
						<p>{numResults} result{numResults === 1 ? '' : 's'}{showExpired && ', ordered by expiry'}:</p>

						<Table basic='very'>
							{!isMobile && <Table.Header>
								<Table.Row>
									<Table.HeaderCell>Shelf ID</Table.HeaderCell>
									<Table.HeaderCell>Owner</Table.HeaderCell>
									<Table.HeaderCell>Expired</Table.HeaderCell>
									<Table.HeaderCell>Memo</Table.HeaderCell>
								</Table.Row>
							</Table.Header>}

							<Table.Body>
								{storageList.filter(filterStorage).sort(sortStorage).map(x =>
									<Table.Row key={x.id}>
										<Table.Cell><Link to={'/storage/'+x.id}>{x.shelf_id}</Link> ({storageTypes[x.location]})</Table.Cell>
										<Table.Cell>
											{isMobile && 'Owner: '}
											{x.member_name && <Icon name='circle' color={statusColor[x.member_status]} />}
											<Link to={'/members/'+x.member_id}>{x.member_name}</Link>
										</Table.Cell>
										<Table.Cell>{isMobile && 'Expired: '}{x.member_paused}</Table.Cell>
										<Table.Cell>{isMobile && 'Memo: '}{x.memo}</Table.Cell>
									</Table.Row>
								)}
							</Table.Body>
						</Table>
					</>
				:
					<p>Loading...</p>
			:
				<p>Error loading.</p>
			}
		</div>
	);
};

export function Storage(props) {
	const { token, user } = props;

	return (
		<Container>
			<Header size='large'>Storage Locations</Header>

			<StorageList {...props} />
		</Container>
	);
};

export function ClaimShelfForm(props) {
	const { token, user, refreshUser } = props;
	const member = user.member;
	const { id } = useParams();
	const [input, setInput] = useState({shelf_id: id});
	const [error, setError] = useState({});
	const [loading, setLoading] = useState(false);
	const history = useHistory();

	const handleValues = (e, v) => setInput({ ...input, [v.name]: v.value });
	const handleChange = (e) => handleValues(e, e.currentTarget);

	const handleSubmit = (e) => {
		if (loading) return;
		setLoading(true);
		requester('/storage/claim/', 'POST', token, input)
		.then(res => {
			setError({});
			refreshUser();
			history.push('/');
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
			<div className='field'>
				<label>Spaceport Username</label>
				<p>{user.username}</p>
			</div>

			<Form.Input
				label='Shelf ID'
				autoComplete='off'
				required
				{...makeProps('shelf_id')}
				maxLength={3}
			/>

			<Form.Button loading={loading} error={error.non_field_errors || error.detail}>
				Submit
			</Form.Button>
		</Form>
	);
};

export function ClaimShelf(props) {
	const { token, user } = props;

	return (
		<Container>
			<Grid stackable columns={2}>
				<Grid.Column>
					<Header size='large'>Claim Member Shelf</Header>

					<p>Use this form to claim a member shelf.</p>

					<p>Please make sure your name and contact info are visible on the shelf.</p>

					<p>Use the Shelf ID visible on the corner label (A1A, A2B, etc.)</p>

					<ClaimShelfForm {...props} />
				</Grid.Column>
			</Grid>
		</Container>
	);
};
