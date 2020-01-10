import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Switch, Route, Link, useParams } from 'react-router-dom';
import './light.css';
import Logo from './logo.svg';
import { Container, Divider, Dropdown, Form, Grid, Header, Icon, Image, Menu, Message, Segment, Table } from 'semantic-ui-react';
import moment from 'moment';
import { requester } from './utils.js';
import { NotFound, PleaseLogin } from './Misc.js';

function ClassTable(props) {
	const { classes } = props;

	const getInstructor = (session) =>
		session.instructor ? session.instructor.first_name : session.old_instructor;

	return (
		<Table basic='very'>
			<Table.Header>
				<Table.Row>
					<Table.HeaderCell>ID</Table.HeaderCell>
					<Table.HeaderCell>Name</Table.HeaderCell>
					<Table.HeaderCell>Date</Table.HeaderCell>
					<Table.HeaderCell>Instructor</Table.HeaderCell>
					<Table.HeaderCell>Cost</Table.HeaderCell>
					<Table.HeaderCell>Students</Table.HeaderCell>
				</Table.Row>
			</Table.Header>

			<Table.Body>
				{classes.length ?
					classes.map((x, i) =>
						<Table.Row key={i}>
							<Table.Cell>{x.id}</Table.Cell>
							<Table.Cell>{x.course.name}</Table.Cell>
							<Table.Cell>
								<Link to={'/classes/'+x.id}>
									{moment.utc(x.datetime).format('ll')}
								</Link>
							</Table.Cell>
							<Table.Cell>{getInstructor(x)}</Table.Cell>
							<Table.Cell>{x.cost === '0.00' ? 'Free' : '$'+x.cost}</Table.Cell>
							<Table.Cell>{x.student_count}</Table.Cell>
						</Table.Row>
					)
				:
					<p>None</p>
				}
			</Table.Body>
		</Table>
	);
};

export function Classes(props) {
	const [classes, setClasses] = useState(false);
	const { token } = props;

	useEffect(() => {
		requester('/sessions/', 'GET', token)
		.then(res => {
			console.log(res);
			setClasses(res.results);
		})
		.catch(err => {
			console.log(err);
		});
	}, []);

	const now = new Date().toISOString();

	return (
		<Container>
			<Header size='large'>Class List</Header>

			<Header size='medium'>Upcoming</Header>
			{classes ?
				<ClassTable classes={classes.filter(x => x.datetime > now)} />
			:
				<p>Loading...</p>
			}

			<Header size='medium'>Recent</Header>
			{classes ?
				<ClassTable classes={classes.filter(x => x.datetime < now)} />
			:
				<p>Loading...</p>
			}
		</Container>
	);
};

export function ClassDetail(props) {
	const [clazz, setClass] = useState(false);
	const [error, setError] = useState(false);
	const { token } = props;
	const { id } = useParams();

	useEffect(() => {
		requester('/sessions/'+id+'/', 'GET', token)
		.then(res => {
			console.log(res);
			setClass(res);
		})
		.catch(err => {
			console.log(err);
			setError(true);
		});
	}, []);

	const getInstructor = (session) =>
		session.instructor ? session.instructor.first_name : session.old_instructor;

	return (
		<Container>
			{!error ?
				clazz ?
					<div>
						<Header size='large'>Class Details</Header>

						<Table unstackable basic='very'>
							<Table.Body>
								<Table.Row>
									<Table.Cell>Name:</Table.Cell>
									<Table.Cell>
										<Link to={'/courses/'+clazz.course.id}>
											{clazz.course.name}
										</Link>
									</Table.Cell>
								</Table.Row>
								<Table.Row>
									<Table.Cell>Date:</Table.Cell>
									<Table.Cell>
										{moment.utc(clazz.datetime).format('ll')}
									</Table.Cell>
								</Table.Row>
								<Table.Row>
									<Table.Cell>Time:</Table.Cell>
									<Table.Cell>
										{moment.utc(clazz.datetime).format('LT')}
									</Table.Cell>
								</Table.Row>
								<Table.Row>
									<Table.Cell>Instructor:</Table.Cell>
									<Table.Cell>{getInstructor(clazz)}</Table.Cell>
								</Table.Row>
								<Table.Row>
									<Table.Cell>Cost:</Table.Cell>
									<Table.Cell>{clazz.cost === '0.00' ? 'Free' : '$'+clazz.cost}</Table.Cell>
								</Table.Row>
								<Table.Row>
									<Table.Cell>Students:</Table.Cell>
									<Table.Cell>{clazz.student_count}</Table.Cell>
								</Table.Row>
							</Table.Body>
						</Table>

						<Header size='medium'>Attendance</Header>
					</div>
				:
					<p>Loading...</p>
			:
				<NotFound />
			}
		</Container>
	);
};

