import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Switch, Route, Link, useParams } from 'react-router-dom';
import './light.css';
import { Button, Container, Divider, Dropdown, Form, Grid, Header, Icon, Image, Input, Item, Menu, Message, Segment, Table } from 'semantic-ui-react';
import { isAdmin, BasicTable, staticUrl, requester } from './utils.js';
import { NotFound, PleaseLogin } from './Misc.js';
import { AdminMemberInfo, AdminMemberForm, AdminMemberCards } from './Admin.js';

export function Members(props) {
	const [response, setResponse] = useState(false);
	const searchDefault = {seq: 0, q: ''};
	const [search, setSearch] = useState(searchDefault);
	const { token } = props;

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

	return (
		<Container>
			<Header size='large'>Member List</Header>

			<Input autoFocus focus icon='search'
				placeholder='Search...'
				value={search.q}
				onChange={(e, v) => setSearch({seq: parseInt(e.timeStamp), q: v.value})}
				aria-label='search products'
				style={{ marginRight: '0.5rem' }}
			/>

			{search.q.length ?
				<Button
					content='Clear'
					onClick={() => setSearch(searchDefault)}
				/> : ''
			}

			<Header size='medium'>
				{search.q.length ? 'Search Results' : 'Newest Vetted Members'}
			</Header>

			{response ?
				<Item.Group unstackable divided>
					{response.results.length ?
						response.results.map((x, i) =>
							<Item key={i} as={Link} to={'/members/'+x.member.id}>
								<Item.Image size='tiny' src={x.member.photo_small ? staticUrl + '/' + x.member.photo_small : '/nophoto.png'} />
								<Item.Content verticalAlign='top'>
									<Item.Header>{x.member.preferred_name} {x.member.last_name}</Item.Header>
									<Item.Description>Status: {x.member.status || 'Unknown'}</Item.Description>
									<Item.Description>Joined: {x.member.current_start_date || 'Unknown'}</Item.Description>
								</Item.Content>
							</Item>
						)
					:
						<p>No Results</p>
					}
				</Item.Group>
			:
				<p>Loading...</p>
			}

		</Container>
	);
};

export function MemberDetail(props) {
	const [result, setResult] = useState(false);
	const [error, setError] = useState(false);
	const { token, user } = props;
	const { id } = useParams();

	useEffect(() => {
		requester('/search/'+id+'/', 'GET', token)
		.then(res => {
			setResult(res);
		})
		.catch(err => {
			console.log(err);
			setError(true);
		});
	}, []);

	const member = result.member || false;

	return (
		<Container>
			{!error ?
				member ?
					<div>
						<Header size='large'>{member.preferred_name} {member.last_name}</Header>

						<Grid stackable columns={2}>
							<Grid.Column>
								<p>
									<Image rounded size='medium' src={member.photo_large ? staticUrl + '/' + member.photo_large : '/nophoto.png'} />
								</p>

								{isAdmin(user) ?
									<AdminMemberInfo result={result} setResult={setResult} {...props} />
								:
									<BasicTable>
										<Table.Body>
											<Table.Row>
												<Table.Cell>Status:</Table.Cell>
												<Table.Cell>{member.status || 'Unknown'}</Table.Cell>
											</Table.Row>
											<Table.Row>
												<Table.Cell>Joined:</Table.Cell>
												<Table.Cell>{member.current_start_date || 'Unknown'}</Table.Cell>
											</Table.Row>
										</Table.Body>
									</BasicTable>
								}
							</Grid.Column>

							<Grid.Column>
								{isAdmin(user) && <Segment padded>
									<AdminMemberForm result={result} setResult={setResult} {...props} />
								</Segment>}
							</Grid.Column>
						</Grid>

						{isAdmin(user) && <Segment padded>
							<AdminMemberCards result={result} setResult={setResult} {...props} />
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

