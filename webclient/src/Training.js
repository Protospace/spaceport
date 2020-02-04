import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Switch, Route, Link, useParams } from 'react-router-dom';
import './light.css';
import { Container, Divider, Dropdown, Form, Grid, Header, Icon, Image, Menu, Message, Segment, Table } from 'semantic-ui-react';
import moment from 'moment';
import { requester } from './utils.js';
import { NotFound, PleaseLogin } from './Misc.js';

export function Training(props) {
	const { user } = props;

	return (
		<Container>
			<Header size='large'>Training</Header>

			{user.training.length ?
				<Table basic='very'>
					<Table.Header>
						<Table.Row>
							<Table.HeaderCell>Course / Event Name</Table.HeaderCell>
							<Table.HeaderCell>Class Date</Table.HeaderCell>
							<Table.HeaderCell>Status</Table.HeaderCell>
							<Table.HeaderCell>Instructor</Table.HeaderCell>
						</Table.Row>
					</Table.Header>

					<Table.Body>
						{user.training.slice().sort((a, b) => a.session.datetime < b.session.datetime ? 1 : -1).map(x =>
							<Table.Row key={x.id}>
								<Table.Cell>{x.session.course_name}</Table.Cell>
								<Table.Cell>
									<Link to={'/classes/'+x.session.id}>{moment(x.session.datetime).format('MMMM Do YYYY')}</Link>
								</Table.Cell>
								<Table.Cell>{x.attendance_status}</Table.Cell>
								<Table.Cell>{x.session.instructor_name}</Table.Cell>
							</Table.Row>
						)}
					</Table.Body>
				</Table>
			:
				<p>No training yet! Sign up for a course to take a class.</p>
			}

		</Container>
	);
};

