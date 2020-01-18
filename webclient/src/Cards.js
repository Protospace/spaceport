import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Switch, Route, Link, useParams } from 'react-router-dom';
import './light.css';
import { Container, Divider, Dropdown, Form, Grid, Header, Icon, Image, Menu, Message, Segment, Table } from 'semantic-ui-react';
import { BasicTable, requester } from './utils.js';
import { NotFound, PleaseLogin } from './Misc.js';

export function Cards(props) {
	const { user } = props;

	const cardStatus = (c) => c.active_status === 'card_active' ? 'Yes' : 'No';
	const card = user.cards[0];

	return (
		<Container>
			<Header size='large'>Member Cards</Header>

			{user.cards.length ?
				user.cards.length > 1 ?
					<Table basic='very'>
						<Table.Header>
							<Table.Row>
								<Table.HeaderCell>Number</Table.HeaderCell>
								<Table.HeaderCell>Notes</Table.HeaderCell>
								<Table.HeaderCell>Last Seen</Table.HeaderCell>
								<Table.HeaderCell>Active</Table.HeaderCell>
							</Table.Row>
						</Table.Header>

						<Table.Body>
							{user.cards.map(x =>
								<Table.Row key={x.id}>
									<Table.Cell>{x.card_number}</Table.Cell>
									<Table.Cell>{x.notes}</Table.Cell>
									<Table.Cell>{x.last_seen_at}</Table.Cell>
									<Table.Cell>{cardStatus(x)}</Table.Cell>
								</Table.Row>
							)}
						</Table.Body>
					</Table>
				:
					<BasicTable>
						<Table.Body>
							<Table.Row>
								<Table.Cell>Number:</Table.Cell>
								<Table.Cell>{card.card_number}</Table.Cell>
							</Table.Row>
							<Table.Row>
								<Table.Cell>Notes:</Table.Cell>
								<Table.Cell>{card.notes}</Table.Cell>
							</Table.Row>
							<Table.Row>
								<Table.Cell>Last Seen:</Table.Cell>
								<Table.Cell>{card.last_seen_at}</Table.Cell>
							</Table.Row>
							<Table.Row>
								<Table.Cell>Active:</Table.Cell>
								<Table.Cell>{cardStatus(card)}</Table.Cell>
							</Table.Row>
						</Table.Body>
					</BasicTable>
			:
				<p>No cards yet! Ask a director for one after you are vetted.</p>
			}

		</Container>
	);
};

