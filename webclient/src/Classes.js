import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Switch, Route, Link, useParams } from 'react-router-dom';
import './light.css';
import { Button, Container, Divider, Dropdown, Form, Grid, Header, Icon, Image, Menu, Message, Segment, Table } from 'semantic-ui-react';
import moment from 'moment';
import { isAdmin, isInstructor, BasicTable, requester } from './utils.js';
import { NotFound, PleaseLogin } from './Misc.js';
import { InstructorClassDetail, InstructorClassAttendance } from './InstructorClasses.js';

function ClassTable(props) {
	const { classes } = props;

	return (
		<Table basic='very'>
			<Table.Header>
				<Table.Row>
					<Table.HeaderCell>Name</Table.HeaderCell>
					<Table.HeaderCell>Date</Table.HeaderCell>
					<Table.HeaderCell>Time</Table.HeaderCell>
					<Table.HeaderCell>Instructor</Table.HeaderCell>
					<Table.HeaderCell>Cost</Table.HeaderCell>
					<Table.HeaderCell>Students</Table.HeaderCell>
				</Table.Row>
			</Table.Header>

			<Table.Body>
				{classes.length ?
					classes.map((x, i) =>
						<Table.Row key={i}>
							<Table.Cell>{x.course_name}</Table.Cell>
							<Table.Cell>
								<Link to={'/classes/'+x.id}>
									{moment.utc(x.datetime).local().format('ll')}
								</Link>
							</Table.Cell>
							<Table.Cell>{x.is_cancelled ? 'Cancelled' : moment.utc(x.datetime).local().format('LT')}</Table.Cell>
							<Table.Cell>{x.instructor_name}</Table.Cell>
							<Table.Cell>{x.cost === '0.00' ? 'Free' : '$'+x.cost}</Table.Cell>
							<Table.Cell>{x.student_count} {x.max_students && '/ '+x.max_students}</Table.Cell>
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
	const { token, user, setUserCache } = props;
	const { id } = useParams();
	const userTraining = user.training.find(x => x.session.id == id);

	useEffect(() => {
		requester('/sessions/'+id+'/', 'GET', token)
		.then(res => {
			setClass(res);
		})
		.catch(err => {
			console.log(err);
			setError(true);
		});
	}, []);

	const handleSignup = () => {
		const data = { attendance_status: 'waiting for payment', session: id };
		requester('/training/', 'POST', token, data)
		.then(res => {
			// bad code:
			const newClass = { ...clazz, student_count: clazz.student_count+1 };
			setUserCache({ ...user, training: [...user.training, {...res, session: newClass }] });
			setClass(newClass);
		})
		.catch(err => {
			console.log(err);
			setError(true);
		});
	};

	const handleToggle = (newStatus) => {
		const data = { attendance_status: newStatus, session: id };
		requester('/training/'+userTraining.id+'/', 'PUT', token, data)
		.then(res => {
			// bad code:
			const studentChange = newStatus === 'withdrawn' ? -1 : 1
			const newClass = { ...clazz, student_count: clazz.student_count + studentChange };
			const trainingIndex = user.training.indexOf(userTraining);
			const newTraining = user.training;
			newTraining[trainingIndex] = {...res, session: newClass };
			setUserCache({ ...user, training: newTraining });
			setClass(newClass);
		})
		.catch(err => {
			console.log(err);
			setError(true);
		});
	};

	// TODO: calculate yesterday and lock signups

	return (
		<Container>
			{!error ?
				clazz ?
					<div>
						<Header size='large'>Class Details</Header>

						{isInstructor(user) && <Segment padded>
							<InstructorClassDetail clazz={clazz} setClass={setClass} {...props} />
						</Segment>}

						<BasicTable>
							<Table.Body>
								<Table.Row>
									<Table.Cell>Name:</Table.Cell>
									<Table.Cell>
										<Link to={'/courses/'+clazz.course}>
											{clazz.course_name}
										</Link>
									</Table.Cell>
								</Table.Row>
								<Table.Row>
									<Table.Cell>Date:</Table.Cell>
									<Table.Cell>
										{moment.utc(clazz.datetime).local().format('ll')}
									</Table.Cell>
								</Table.Row>
								<Table.Row>
									<Table.Cell>Time:</Table.Cell>
									<Table.Cell>
										{clazz.is_cancelled ? 'Cancelled' : moment.utc(clazz.datetime).local().format('LT')}
									</Table.Cell>
								</Table.Row>
								<Table.Row>
									<Table.Cell>Instructor:</Table.Cell>
									<Table.Cell>{clazz.instructor_name}</Table.Cell>
								</Table.Row>
								<Table.Row>
									<Table.Cell>Cost:</Table.Cell>
									<Table.Cell>{clazz.cost === '0.00' ? 'Free' : '$'+clazz.cost}</Table.Cell>
								</Table.Row>
								<Table.Row>
									<Table.Cell>Students:</Table.Cell>
									<Table.Cell>{clazz.student_count} {clazz.max_students && '/ '+clazz.max_students}</Table.Cell>
								</Table.Row>
							</Table.Body>
						</BasicTable>

						<Header size='medium'>Attendance</Header>

						{(isAdmin(user) || clazz.instructor === user.id) &&
							<Segment padded>
								<InstructorClassAttendance clazz={clazz} {...props} />
							</Segment>
						}

						{clazz.instructor != user.id &&
							(userTraining ?
								<div>
									<p>Status: {userTraining.attendance_status}</p>
									{userTraining.attendance_status === 'withdrawn' ?
										<Button onClick={() => handleToggle('waiting for payment')}>
											Sign back up
										</Button>
									:
										<Button onClick={() => handleToggle('withdrawn')}>
											Withdraw from Class
										</Button>
									}
								</div>
							:
								((clazz.max_students && clazz.student_count >= clazz.max_students) ?
									<p>The course is full.</p>
								:
									<Button onClick={handleSignup}>
										Sign me up!
									</Button>
								)
							)
						}
					</div>
				:
					<p>Loading...</p>
			:
				<NotFound />
			}
		</Container>
	);
};

