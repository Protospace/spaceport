import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Switch, Route, Link, useParams } from 'react-router-dom';
import './light.css';
import { Container, Divider, Dropdown, Form, Grid, Header, Icon, Image, Menu, Message, Segment, Table } from 'semantic-ui-react';
import moment from 'moment';
import { isInstructor, requester } from './utils.js';
import { NotFound, PleaseLogin } from './Misc.js';
import { InstructorCourseList, InstructorCourseDetail } from './InstructorCourses.js';
import { InstructorClassList } from './InstructorClasses.js';

export function Courses(props) {
	const [courses, setCourses] = useState(false);
	const { token, user } = props;

	useEffect(() => {
		requester('/courses/', 'GET', token)
		.then(res => {
			setCourses(res.results);
		})
		.catch(err => {
			console.log(err);
		});
	}, []);

	return (
		<Container>
			<Header size='large'>Courses</Header>

			{isInstructor(user) && <Segment padded>
				<InstructorCourseList courses={courses} setCourses={setCourses} {...props} />
			</Segment>}

			{courses ?
				<Table basic='very'>
					<Table.Header>
						<Table.Row>
							<Table.HeaderCell>Name</Table.HeaderCell>
						</Table.Row>
					</Table.Header>

					<Table.Body>
						{courses.length ?
							courses.map((x, i) =>
								<Table.Row key={i}>
									<Table.Cell>
										<Link to={'/courses/'+x.id}>{x.name}</Link>
									</Table.Cell>
								</Table.Row>
							)
						:
							<Table.Row><Table.Cell>None</Table.Cell></Table.Row>
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
	const { token, user } = props;
	const { id } = useParams();

	useEffect(() => {
		requester('/courses/'+id+'/', 'GET', token)
		.then(res => {
			setCourse(res);
		})
		.catch(err => {
			console.log(err);
			setError(true);
		});
	}, []);

	return (
		<Container>
			{!error ?
				course ?
					<div>
						<Header size='large'>{course.name}</Header>

						{isInstructor(user) && <Segment padded>
							<InstructorCourseDetail course={course} setCourse={setCourse} {...props} />
						</Segment>}

						<Header size='medium'>Course Description</Header>
						{course.is_old ?
							course.description.split('\n').map((x, i) =>
								<p key={i}>{x}</p>
							)
						:
							<div dangerouslySetInnerHTML={{__html: course.description}} />
						}

						<Header size='medium'>Classes</Header>

						{isInstructor(user) && <Segment padded>
							<InstructorClassList course={course} setCourse={setCourse} {...props} />
						</Segment>}

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
													{moment.utc(x.datetime).local().format('ll')}
												</Link>
											</Table.Cell>
											<Table.Cell>{x.is_cancelled ? 'Cancelled' : moment.utc(x.datetime).local().format('LT')}</Table.Cell>
											<Table.Cell>{x.instructor_name}</Table.Cell>
											<Table.Cell>{x.cost === '0.00' ? 'Free' : '$'+x.cost}</Table.Cell>
										</Table.Row>
									)
								:
									<Table.Row><Table.Cell>None</Table.Cell></Table.Row>
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

