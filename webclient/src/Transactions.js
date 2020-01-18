import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Switch, Route, Link, useParams } from 'react-router-dom';
import './light.css';
import { Container, Divider, Dropdown, Form, Grid, Header, Icon, Image, Menu, Message, Segment, Table } from 'semantic-ui-react';
import { BasicTable, requester } from './utils.js';
import { NotFound, PleaseLogin } from './Misc.js';

export function Transactions(props) {
	const { user } = props;

	return (
		<Container>
			<Header size='large'>Transactions</Header>

			<Table basic='very'>
				<Table.Header>
					<Table.Row>
						<Table.HeaderCell>Date</Table.HeaderCell>
						<Table.HeaderCell>Amount</Table.HeaderCell>
						<Table.HeaderCell>Account</Table.HeaderCell>
						<Table.HeaderCell>Memo</Table.HeaderCell>
					</Table.Row>
				</Table.Header>

				<Table.Body>
					{user.transactions.length ?
						user.transactions.slice().reverse().map(x =>
							<Table.Row key={x.id}>
								<Table.Cell>
									<Link to={'/transactions/'+x.id}>{x.date}</Link>
								</Table.Cell>
								<Table.Cell>${x.amount}</Table.Cell>
								<Table.Cell>{x.account_type}</Table.Cell>
								<Table.Cell>{x.memo}</Table.Cell>
							</Table.Row>
						)
					:
						<Table.Row><Table.Cell>None</Table.Cell></Table.Row>
					}
				</Table.Body>
			</Table>

		</Container>
	);
};

export function TransactionDetail(props) {
	const { user } = props;
	const { id } = useParams();

	const t = user.transactions.find(x => x.id == id);

	return (
		t ?
			<Container>
				<Header size='large'>Transaction Receipt</Header>

				<BasicTable>
					<Table.Body>
						<Table.Row>
							<Table.Cell>Date:</Table.Cell>
							<Table.Cell>{t.date}</Table.Cell>
						</Table.Row>
						<Table.Row>
							<Table.Cell>ID:</Table.Cell>
							<Table.Cell>{t.id}</Table.Cell>
						</Table.Row>
						<Table.Row>
							<Table.Cell>Amount:</Table.Cell>
							<Table.Cell>${t.amount}</Table.Cell>
						</Table.Row>
						<Table.Row>
							<Table.Cell>Category:</Table.Cell>
							<Table.Cell>{t.category}</Table.Cell>
						</Table.Row>
						<Table.Row>
							<Table.Cell>Account:</Table.Cell>
							<Table.Cell>{t.account_type}</Table.Cell>
						</Table.Row>
						<Table.Row>
							<Table.Cell>Info Source:</Table.Cell>
							<Table.Cell>{t.info_source}</Table.Cell>
						</Table.Row>
						<Table.Row>
							<Table.Cell>Reference:</Table.Cell>
							<Table.Cell>{t.reference_number}</Table.Cell>
						</Table.Row>
						<Table.Row>
							<Table.Cell>Memo:</Table.Cell>
							<Table.Cell>{t.memo}</Table.Cell>
						</Table.Row>
					</Table.Body>
				</BasicTable>

			</Container>
		:
			<NotFound />
	);
};

