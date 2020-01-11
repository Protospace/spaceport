import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Switch, Route, Link, useParams } from 'react-router-dom';
import './light.css';
import { Button, Container, Divider, Dropdown, Form, Grid, Header, Icon, Image, Input, Item, Menu, Message, Segment, Table } from 'semantic-ui-react';
import moment from 'moment';
import { BasicTable, staticUrl, requester } from './utils.js';
import { NotFound, PleaseLogin } from './Misc.js';

export function Members(props) {
	const [members, setMembers] = useState(false);
	const searchDefault = {seq: 0, q: ''};
	const [search, setSearch] = useState(searchDefault);
	const { token } = props;

	useEffect(() => {
		requester('/search/', 'POST', token, search)
		.then(res => {
			if (!search.seq || res.seq > members.seq) {
				setMembers(res);
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
				onChange={(e, v) => setSearch({seq: e.timeStamp, q: v.value})}
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

			{members ?
				<Item.Group divided>
					{members.results.length ?
						members.results.map((x, i) =>
							<Item key={i} as={Link} to={'/members/'+x.id}>
								<Item.Image size='tiny' src={x.photo_small ? staticUrl + '/' + x.photo_small : '/nophoto.png'} />
								<Item.Content verticalAlign='top'>
									<Item.Header>{x.preferred_name} {x.last_name}</Item.Header>
									<Item.Description>Status: {x.status || 'Unknown'}</Item.Description>
									<Item.Description>Joined: {x.current_start_date || 'Unknown'}</Item.Description>
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
	const [member, setMember] = useState(false);
	const [error, setError] = useState(false);
	const { token } = props;
	const { id } = useParams();

	useEffect(() => {
		requester('/search/'+id+'/', 'GET', token)
		.then(res => {
			setMember(res);
		})
		.catch(err => {
			console.log(err);
			setError(true);
		});
	}, []);

	return (
		<Container>
			{!error ?
				member ?
					<div>
						<Header size='large'>{member.preferred_name} {member.last_name}</Header>

						<Image rounded size='medium' src={member.photo_large ? staticUrl + '/' + member.photo_large : '/nophoto.png'} />

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
					</div>
				:
					<p>Loading...</p>
			:
				<NotFound />
			}
		</Container>
	);
};

