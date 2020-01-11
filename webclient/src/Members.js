import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Switch, Route, Link, useParams } from 'react-router-dom';
import './light.css';
import { Container, Divider, Dropdown, Form, Grid, Header, Icon, Image, Input, Menu, Message, Segment, Table } from 'semantic-ui-react';
import moment from 'moment';
import { requester } from './utils.js';
import { NotFound, PleaseLogin } from './Misc.js';

export function Members(props) {
	const [members, setMembers] = useState(false);
	const [search, setSearch] = useState({seq: 0, q: ''});
	const { token } = props;

	useEffect(() => {
		requester('/search/', 'POST', token, search)
		.then(res => {
			if (!members || res.seq > members.seq) {
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
				value={search.v}
				onChange={(e, v) => setSearch({seq: e.timeStamp, q: v.value})}
				aria-label='search products'
			/>

			<Header size='medium'>
				{search.q.length ? 'Search Results' : 'Recently Vetted'}
			</Header>

			{members ?
				<Table basic='very'>
					<Table.Header>
						<Table.Row>
							<Table.HeaderCell>Name</Table.HeaderCell>
							<Table.HeaderCell>Status</Table.HeaderCell>
							<Table.HeaderCell>Member Since</Table.HeaderCell>
						</Table.Row>
					</Table.Header>

					<Table.Body>
						{members.results.length ?
							members.results.map((x, i) =>
								<Table.Row key={i}>
									<Table.Cell>{x.preferred_name} {x.last_name}</Table.Cell>
									<Table.Cell>{x.status}</Table.Cell>
									<Table.Cell>{x.current_start_date}</Table.Cell>
								</Table.Row>
							)
						:
							<Table.Row><Table.Cell>No Results</Table.Cell></Table.Row>
						}
					</Table.Body>
				</Table>
			:
				<p>Loading...</p>
			}

		</Container>
	);
};

