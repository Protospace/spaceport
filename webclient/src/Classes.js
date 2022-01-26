import React, { useState, useEffect, useReducer } from 'react';
import { BrowserRouter as Router, Switch, Route, Link, useParams } from 'react-router-dom';
import './light.css';
import { Button, Container, Divider, Dropdown, Form, Grid, Header, Icon, Image, Menu, Message, Segment, Table } from 'semantic-ui-react';
import moment from 'moment-timezone';
import { isAdmin, isInstructor, getInstructor, BasicTable, requester } from './utils.js';
import { NotFound, PleaseLogin } from './Misc.js';
import { InstructorClassDetail, InstructorClassAttendance } from './InstructorClasses.js';
import { PayPalPayNow } from './PayPal.js';

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
					classes.map(x =>
						<Table.Row key={x.id}>
							<Table.Cell>{x.course_data.name}</Table.Cell>
							<Table.Cell>
								<Link to={'/classes/'+x.id}>
									{moment.utc(x.datetime).tz('America/Edmonton').format('ll')}
								</Link>
							</Table.Cell>
							<Table.Cell>{x.is_cancelled ? 'Cancelled' : moment.utc(x.datetime).tz('America/Edmonton').format('LT')}</Table.Cell>
							<Table.Cell>{getInstructor(x)}</Table.Cell>
							<Table.Cell>{x.cost === '0.00' ? 'Free' : '$'+x.cost}</Table.Cell>
							<Table.Cell>{x.student_count} {!!x.max_students && '/ '+x.max_students}</Table.Cell>
						</Table.Row>
					)
				:
					<Table.Row><Table.Cell>None</Table.Cell></Table.Row>
				}
			</Table.Body>
		</Table>
	);
};

let classesCache = false;

export function ClassFeed(props) {
	const [classes, setClasses] = useState(classesCache);

	useEffect(() => {
		const get = async() => {
			requester('/sessions/', 'GET', '')
			.then(res => {
				setClasses(res.results);
				classesCache = res.results;
			})
			.catch(err => {
				console.log(err);
			});
		};

		get();
		const interval = setInterval(get, 60000);
		return () => clearInterval(interval);
	}, []);

	const now = new Date().toISOString();

	return (
		<Container>
			<p/>

			<Header size='large'>Upcoming Protospace Classes</Header>

			{classes ?
				<ClassTable classes={classes.filter(x => x.datetime > now).sort((a, b) => a.datetime > b.datetime ? 1 : -1)} />
			:
				<p>Loading...</p>
			}
		</Container>
	);
};

export function Classes(props) {
	const [classes, setClasses] = useState(classesCache);
	const { token } = props;

	useEffect(() => {
		requester('/sessions/', 'GET', token)
		.then(res => {
			setClasses(res.results);
			classesCache = res.results;
		})
		.catch(err => {
			console.log(err);
		});
	}, []);

	const now = new Date().toISOString();

	return (
		<Container>
			<Header size='large'>Class List</Header>

			<p><Link to={'/courses'}>Click here to view the list of all courses.</Link></p>

			<Header size='medium'>Upcoming</Header>

			<p>Ordered by nearest date.</p>

			{classes ?
				<ClassTable classes={classes.filter(x => x.datetime > now).sort((a, b) => a.datetime > b.datetime ? 1 : -1)} />
			:
				<p>Loading...</p>
			}

			<Header size='medium'>Recent</Header>

			<p>Ordered by nearest date.</p>

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
	const [refreshCount, refreshClass] = useReducer(x => x + 1, 0);
	const [error, setError] = useState(false);
	const [loading, setLoading] = useState(false);
	const { token, user, refreshUser } = props;
	const { id } = useParams();
	const userTraining = clazz && clazz.students.find(x => x.user == user.id);

	useEffect(() => {
		requester('/sessions/'+id+'/', 'GET', token)
		.then(res => {
			setClass(res);
		})
		.catch(err => {
			console.log(err);
			setError(true);
		});
	}, [refreshCount]);

	const handleSignup = () => {
		if (loading) return;
		setLoading(true);
		const data = { attendance_status: 'Waiting for payment', session: id };
		requester('/training/', 'POST', token, data)
		.then(res => {
			refreshClass();
			refreshUser();
		})
		.catch(err => {
			console.log(err);
		});
	};

	const handleToggle = (newStatus) => {
		if (loading) return;
		setLoading(true);
		const data = { attendance_status: newStatus, session: id };
		requester('/training/'+userTraining.id+'/', 'PUT', token, data)
		.then(res => {
			refreshClass();
			refreshUser();
		})
		.catch(err => {
			console.log(err);
			setError(true);
		});
	};

	useEffect(() => {
		setLoading(false);
	}, [userTraining]);

	// TODO: calculate yesterday and lock signups

	return (
		<Container>
			{!error ?
				clazz ?
					<div>
						<Header size='large'>Class Details</Header>

						{(isAdmin(user) || clazz.instructor === user.id) &&
							<Segment padded>
								<InstructorClassDetail clazz={clazz} setClass={setClass} {...props} />
							</Segment>
						}

						<BasicTable>
							<Table.Body>
								<Table.Row>
									<Table.Cell>Name:</Table.Cell>
									<Table.Cell>
										<Link to={'/courses/'+clazz.course}>
											{clazz.course_data.name}
										</Link>
									</Table.Cell>
								</Table.Row>
								<Table.Row>
									<Table.Cell>Date:</Table.Cell>
									<Table.Cell>
										{moment.utc(clazz.datetime).tz('America/Edmonton').format('ll')}
									</Table.Cell>
								</Table.Row>
								<Table.Row>
									<Table.Cell>Time:</Table.Cell>
									<Table.Cell>
										{clazz.is_cancelled ? 'Cancelled' : moment.utc(clazz.datetime).tz('America/Edmonton').format('LT')}
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
									<Table.Cell>{clazz.student_count} {!!clazz.max_students && '/ '+clazz.max_students}</Table.Cell>
								</Table.Row>
							</Table.Body>
						</BasicTable>

						<Header size='medium'>Course Description</Header>
						{clazz.course_data.is_old ?
							clazz.course_data.description.split('\n').map((x, i) =>
								<p key={i}>{x}</p>
							)
						:
							<div dangerouslySetInnerHTML={{__html: clazz.course_data.description}} />
						}

						<Header size='medium'>Attendance</Header>

						{(isAdmin(user) || clazz.instructor === user.id) &&
							<Segment padded>
								<InstructorClassAttendance clazz={clazz} refreshClass={refreshClass} {...props} />
							</Segment>
						}

						{clazz.instructor != user.id &&
							(userTraining ?
								<div>
									<p>Status: {userTraining.attendance_status}</p>
									<p>
										{userTraining.attendance_status === 'Withdrawn' ?
											<Button loading={loading} onClick={() => handleToggle('Waiting for payment')}>
												Sign back up
											</Button>
										:
											<Button loading={loading} onClick={() => handleToggle('Withdrawn')}>
												Withdraw from Class
											</Button>
										}
									</p>

									{userTraining.attendance_status === 'Waiting for payment' &&
										<div>
											<p>Please pay the course fee of ${clazz.cost} to confirm your attendance.</p>
											<PayPalPayNow
												amount={clazz.cost}
												name={clazz.course_data.name}
												custom={JSON.stringify({ training: userTraining.id })}
											/>
										</div>
									}
								</div>
							:
								(clazz.is_cancelled ?
									<p>The class is cancelled.</p>
								:
									((clazz.max_students && clazz.student_count >= clazz.max_students) ?
										<p>The class is full.</p>
									:
										<Button loading={loading} onClick={handleSignup}>
											Sign me up!
										</Button>
									)
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

