import React, { useState, useEffect, useReducer } from 'react';
import { Link, useParams } from 'react-router-dom';
import './light.css';
import { Button, Container, Dropdown, Grid, Header, Icon, Image, Input, Item, Segment, Table } from 'semantic-ui-react';
import { statusColor, isAdmin, isInstructor, BasicTable, staticUrl, requester } from './utils.js';
import { NotFound } from './Misc.js';
import { AdminMemberInfo, AdminMemberPause, AdminMemberForm, AdminMemberCards, AdminMemberTraining, AdminMemberCertifications } from './AdminMembers.js';
import { AdminMemberTransactions } from './AdminTransactions.js';
import AbortController from 'abort-controller';

const memberSorts = {
	recently_vetted: 'Recently Vetted',
	last_scanned: 'Last Scanned',
	newest_active: 'Newest',
	//newest_overall: 'Newest Overall',
	oldest_active: 'Oldest',
	//oldest_overall: 'Oldest Overall',
	recently_inactive: 'Recently Inactive',
	is_director: 'Directors',
	is_instructor: 'Instructors',
	due: 'Due',
	overdue: 'Overdue',
	everyone: 'Everyone',
};

export function MembersDropdown(props) {
	const { token, name, onChange, value, initial } = props;
	const [response, setResponse] = useState({ results: [] });
	const searchDefault = {seq: 0, q: initial || ''};
	const [search, setSearch] = useState(searchDefault);

	useEffect(() => {
		requester('/search/', 'POST', token, search)
		.then(res => {
			if (!search.seq || res.seq > response.seq) {
				setResponse(res);
			}
		})
		.catch(err => {
			console.log(err);
		});
	}, [search]);

	const options = response.results.map((x, i) => ({
		key: x.member.id,
		value: x.member.id,
		text: x.member.preferred_name + ' ' + x.member.last_name,
		image: { avatar: true, src: x.member.photo_small ? staticUrl + '/' + x.member.photo_small : '/nophoto.png' },
	}));

	return (
		<Dropdown
			clearable
			fluid
			selection
			search
			name={name}
			options={options}
			value={value}
			placeholder='Search for Member'
			onChange={onChange}
			onSearchChange={(e, v) => setSearch({seq: parseInt(e.timeStamp), q: v.searchQuery})}
		/>

	);
};

let responseCache = false;
let pageCache = 0;
let sortCache = '';
let searchCache = '';

const loadMoreStrings = [
	'Load More',
	'Load EVEN More',
	'Load WAY More',
	'Why did you stop? LOAD MORE!',
	'GIVE ME MORE NAMES!!',
	'Shower me with names, baby',
	'I don\'t care about the poor server, MORE NAMES!',
	'Names make me hotter than two rats in a wool sock',
	'Holy shit, I can\'t get enough names',
	'I don\'t have anything better to do than LOAD NAMES!',
	'I need names because I love N̶a̸M̸E̵S̴ it\'s not to late to stop but I can\'t because it feels so good god help me',
	'The One who loads the names will liquify the NERVES of the sentient whilst I o̴̭̐b̴̙̾s̷̺͝ē̶̟r̷̦̓v̸͚̐ę̸̈́ ̷̞̒t̸͘ͅh̴͂͜e̵̜̕i̶̾͜r̷̃͜ ̵̹͊Ḷ̷͝Ȍ̸͚Ä̶̘́D̴̰́I̸̧̚N̵͖̎G̷̣͒',
	'The Song of Names will will e̶̟̤͋x̷̜̀͘͜t̴̳̀i̸̪͑̇n̷̘̍g̵̥̗̓ṳ̴̑̈́i̷͚̿s̸̨̪̓ḣ̶̡̓ ̷̲͊ṫ̴̫h̸̙͕͗ḛ̸̡̃̈́ ̷̘̫̉̏v̸̧̟͗̕o̴͕̾͜i̷̢͛̿ͅc̴͕̥̈́̂ȅ̵͕s̶̹͋̀ ̶̰́͜͠ǒ̷̰̯f̵̛̥̊ ̸̟̟̒͝m̸̯̀̂o̶̝͛̌͜r̸̞̀ṫ̴̥͗ä̶̢́l̶̯̄͘ ̵̫̈́m̷̦̑̂ą̶͕͝ṋ̴̎͝ from the sphere I can see it can you see it it is beautiful',
	'The final suffering of T̷̯̂͝H̴̰̏̉Ḛ̸̀̓ ̷̟̒ͅN̷̠̾Ą̵̟̈́M̶̡̾͝E̸̥̟̐͐S̸̖̍ are lies all is lost the pony he come h̷̲̺͂̾͒̔͝ḙ̶̻͒͠ ̷̙̘͈̬̰̽̽̈́̒͘c̵͎̺̞̰͝ơ̷͚̱̺̰̺͐̏͑͠m̴̖̰̓̈͝ĕ̷̜s̶̛̹̤̦͉̓͝ the í̵̠̞̙̦̱̠̅̊͒̌͊̓͠͠c̴̻̺̙͕̲͚͔̩̥͑ḩ̷̦̰̠̯̳̖̘́̉̾̾͠o̴͈̯̟̣̲͙̦̖̖͍̞̞̻̎͐̊͊̇͋̒͛̅͆̌͂̈̕r̷̡̝̲̜͇͉̣̹̖͕̻̐̑̉̋͋̉͒͋̍́̒͐͐͘ͅ ̵̳̖͕̩̝̮͈̻̣̤͎̟͓̜̄̿̓̈́p̴̰̝͓̣͍̫̞͓̑͌͊͑̓̂̽͑͝e̶̛̪̜̐̋́̆͊͌̋̄́͘r̶̫̬͈͌̔̽m̶̛̱̣͍͌̈́͋̾̈̀͑̽̋̏̊͋͝ę̶̋̀̈̃͠ą̵̡̣̫̮͙͈͚̞̰̠̥͇̣̽̿̉́̔̒͌̓͌̂̌̕͜͠t̷̯͚̭̮̠̐͋͆́͛̿́̏̆̚ě̶̢̨̩̞ş̸̢͍̱̻͕̪̗̻͖͇̱̳̽̈́̚͠ ̴͉̝̖̤͚̖̩̻̪̒ͅà̸̙̥̩̠̝̪̰͋́̊̓͌́͒̕͝ĺ̵̖̖͚̱͎̤̟̲̺͎͑͋̐̈́̓͂͆̅̈́̎̆̋̇l̸̢̧̟͉̞͇̱͉̙͇͊̏͐͠ͅ',
];

export function Members(props) {
	const [response, setResponse] = useState(responseCache);
	const [loading, setLoading] = useState(false);
	const [page, setPage] = useState(pageCache);
	const [sort, setSort] = useState(sortCache);
	const [search, setSearch] = useState(searchCache);
	const [controller, setController] = useState(false);
	const { token, user } = props;

	const makeRequest = ({loadPage, q, sort_key}) => {
		let pageNum = 0;
		if (loadPage) {
			pageNum = page + 1;
			setPage(pageNum);
			pageCache = pageNum;
		} else {
			setResponse(false);
			setPage(0);
			pageCache = 0;
		}

		if (controller) {
			controller.abort();
		}
		const ctl = new AbortController();
		setController(ctl);
		const signal = ctl.signal;

		const data = {page: pageNum};
		if (q) data.q = q;
		if (sort_key) data.sort = sort_key;

		requester('/search/', 'POST', token, data, signal)
		.then(res => {
			const r = loadPage ? {...response, results: [...response.results, ...res.results]} : res;
			setResponse(r);
			responseCache = r;
			setLoading(false);
		})
		.catch(err => {
			console.log('Aborted.');
		});
	}

	const loadMore = () => {
		setLoading(true);
		makeRequest({loadPage: true, q: search, sort_key: sort});
	};

	const doSort = (sort_key) => {
		setSort(sort_key);
		sortCache = sort_key;
		setSearch('');
		searchCache = '';
		makeRequest({loadPage: false, sort_key: sort_key});
	};

	const doSearch = (q) => {
		if (q) {
			setSearch(q);
			searchCache = q;
			setSort('');
			sortCache = '';
			makeRequest({loadPage: false, q: q});
		} else {
			doSort('recently_vetted');
		}
	};

	const handleChange = (event) => {
		const q = event.target.value;
		doSearch(q);
	};

	useEffect(() => {
		if (!responseCache) {
			doSort('recently_vetted');
		}
	}, []);

	return (
		<Container>
			<Header size='large'>Member List</Header>

			<p>Search by name, email, Spacebar username, or member ID:</p>

			<Input autoFocus focus icon='search'
				placeholder='Search...'
				value={search}
				onChange={handleChange}
				aria-label='search products'
				style={{ marginRight: '0.5rem' }}
			/>

			{search.length ?
				<Button
					content='Clear'
					onClick={() => doSearch('')}
				/> : ''
			}

			<p></p>

			<p>
				Sort by{' '}
				{Object.entries(memberSorts).map((x, i) =>
					<React.Fragment key={x[0]}>
						<a href='javascript:void(0)' onClick={() => doSort(x[0])}>{x[1]}</a>
						{i < Object.keys(memberSorts).length - 1 && ', '}
					</React.Fragment>
				)}.
			</p>

			<Header size='medium'>
				{search.length ? 'Search Results' : memberSorts[sort]}
			</Header>

			{sort === 'last_scanned' &&
				(user.member.allow_last_scanned ?
					<p>Hide yourself from this list on the <Link to='/account'>Account Settings</Link> page.</p>
				:
					<p>Participate in this list on the <Link to='/account'>Account Settings</Link> page.</p>
				)
			}

			{response ?
				<>
					<p>{response.total} results:</p>

					<Item.Group unstackable divided>
						{!!response.results.length &&
							response.results.map((x, i) =>
								<Item key={x.member.id} as={Link} to={'/members/'+x.member.id}>
									<div className='list-num'>{i+1}</div>
									<Item.Image size='tiny' src={x.member.photo_small ? staticUrl + '/' + x.member.photo_small : '/nophoto.png'} />
									<Item.Content verticalAlign='top'>
										<Item.Header>
											<Icon name='circle' color={statusColor[x.member.status]} />
											{x.member.preferred_name} {x.member.last_name}
										</Item.Header>
										<Item.Description>Status: {x.member.status || 'Unknown'}</Item.Description>
										<Item.Description>Joined: {x.member.application_date || 'Unknown'}</Item.Description>
										<Item.Description>ID: {x.member.id}</Item.Description>
									</Item.Content>
								</Item>
							)
						}
					</Item.Group>

					{!search && response.total !== response.results.length &&
						<Button content={loading ? 'Reticulating splines...' : loadMoreStrings[page]} onClick={loadMore} disabled={loading} />
					}
				</>
			:
				<p>Loading...</p>
			}

		</Container>
	);
};

let resultCache = {};

export function MemberDetail(props) {
	const { id } = useParams();
	const [result, setResult] = useState(resultCache[id] || false);
	const [refreshCount, refreshResult] = useReducer(x => x + 1, 0);
	const [error, setError] = useState(false);
	const { token, user } = props;

	useEffect(() => {
		requester('/search/'+id+'/', 'GET', token)
		.then(res => {
			setResult(res);
			resultCache[id] = res;
		})
		.catch(err => {
			console.log(err);
			setError(true);
		});
	}, [refreshCount]);

	const member = result.member || false;
	const photo = member?.photo_large || member?.photo_small || false;

	return (
		<Container>
			{!error ?
				member ?
					<div>
						<Header size='large'>{member.preferred_name} {member.last_name}</Header>

						<Grid stackable columns={2}>
							<Grid.Column width={isAdmin(user) ? 8 : 5}>
								<p>
									<Image rounded size='medium' src={photo ? staticUrl + '/' + photo : '/nophoto.png'} />
								</p>

								{isAdmin(user) ?
									<AdminMemberInfo result={result} refreshResult={refreshResult} {...props} />
								:
									<React.Fragment>
										<BasicTable>
											<Table.Body>
												<Table.Row>
													<Table.Cell>Status:</Table.Cell>
													<Table.Cell>
														<Icon name='circle' color={statusColor[member.status]} />
														{member.status || 'Unknown'}
													</Table.Cell>
												</Table.Row>
												<Table.Row>
													<Table.Cell>Joined:</Table.Cell>
													<Table.Cell>{member.application_date || 'Unknown'}</Table.Cell>
												</Table.Row>
												<Table.Row>
													<Table.Cell>Public Bio:</Table.Cell>
												</Table.Row>
											</Table.Body>
										</BasicTable>

										<p className='bio-paragraph'>
											{member.public_bio || 'None yet.'}
										</p>
									</React.Fragment>
								}
							</Grid.Column>

							<Grid.Column width={isAdmin(user) ? 8 : 11}>
								{isInstructor(user) && !isAdmin(user) && <Segment padded>
									<AdminMemberTraining result={result} refreshResult={refreshResult} {...props} />
								</Segment>}

								{isAdmin(user) && <Segment padded>
									<AdminMemberForm result={result} refreshResult={refreshResult} {...props} />
								</Segment>}

								{isAdmin(user) && <Segment padded>
									<AdminMemberPause result={result} refreshResult={refreshResult} {...props} />
								</Segment>}
							</Grid.Column>
						</Grid>

						{isAdmin(user) && <Segment padded>
							<AdminMemberCards result={result} refreshResult={refreshResult} {...props} />
						</Segment>}

						{isAdmin(user) && <Segment padded>
							<AdminMemberCertifications result={result} refreshResult={refreshResult} {...props} />
						</Segment>}

						{isAdmin(user) && <Segment padded>
							<AdminMemberTraining result={result} refreshResult={refreshResult} {...props} />
						</Segment>}

						{isAdmin(user) && <Segment padded>
							<AdminMemberTransactions result={result} refreshResult={refreshResult} {...props} />
						</Segment>}

					</div>
				:
					<p>Loading...</p>
			:
				<NotFound />
			}
		</Container>
	);
};

