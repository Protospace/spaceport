import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Switch, Route, Link, useParams } from 'react-router-dom';
import './light.css';
import Logo from './logo.svg';
import { Container, Divider, Dropdown, Form, Grid, Header, Icon, Image, Menu, Message, Segment, Table } from 'semantic-ui-react';
import moment from 'moment';
import { requester } from './utils.js';
import { NotFound, PleaseLogin } from './Misc.js';

export function Courses(props) {
	const [courses, setCourses] = useState(false);
	const { token } = props;

	useEffect(() => {
		requester('/courses/', 'GET', token)
		.then(res => {
			console.log(res);
			setCourses(res.results);
		})
		.catch(err => {
			console.log(err);
		});
	}, []);

	return (
		<Container>
			<Header size='large'>Courses / Events</Header>

			{courses ?
				<Table basic='very'>
					<Table.Header>
						<Table.Row>
							<Table.HeaderCell>ID</Table.HeaderCell>
							<Table.HeaderCell>Name</Table.HeaderCell>
						</Table.Row>
					</Table.Header>

					<Table.Body>
						{courses.length ?
							courses.map((x, i) =>
								<Table.Row key={i}>
									<Table.Cell>{x.id}</Table.Cell>
									<Table.Cell>
										<Link to={'/courses/'+x.id}>{x.name}</Link>
									</Table.Cell>
								</Table.Row>
							)
						:
							<p>None</p>
						}
					</Table.Body>
				</Table>
			:
				<p>Loading...</p>
			}

		</Container>
	);
};

export function CourseDetail(props) {
	const [course, setCourse] = useState(false);
	const [error, setError] = useState(false);
	const { token } = props;
	const { id } = useParams();

	useEffect(() => {
		requester('/courses/'+id+'/', 'GET', token)
		.then(res => {
			console.log(res);
			setCourse(res);
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
				course ?
					<div>
						<Header size='large'>{course.name}</Header>

						<Header size='medium'>Course Description</Header>
						{course.description.split('\n').map((x, i) =>
							<p key={i}>{x}</p>
						)}

						<Header size='medium'>Classes</Header>
						<Table basic='very'>
							<Table.Header>
								<Table.Row>
									<Table.HeaderCell>Date</Table.HeaderCell>
									<Table.HeaderCell>Time</Table.HeaderCell>
									<Table.HeaderCell>Instructor</Table.HeaderCell>
									<Table.HeaderCell>Cost</Table.HeaderCell>
								</Table.Row>
							</Table.Header>

							<Table.Body>
								{course.sessions.length ?
									course.sessions.sort((a, b) => a.datetime < b.datetime).map((x, i) =>
										<Table.Row key={i}>
											<Table.Cell>
												<Link to={'/classes/'+x.id}>
													{moment.utc(x.datetime).format('LL')}
												</Link>
											</Table.Cell>
											<Table.Cell>{moment.utc(x.datetime).format('LT')}</Table.Cell>
											<Table.Cell>{getInstructor(x)}</Table.Cell>
											<Table.Cell>{x.cost === '0.00' ? 'Free' : '$'+x.cost}</Table.Cell>
										</Table.Row>
									)
								:
									<p>None</p>
								}
							</Table.Body>
						</Table>
					</div>
				:
					<p>Loading...</p>
			:
				<NotFound />
			}
		</Container>
	);
};

