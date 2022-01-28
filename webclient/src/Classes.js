import React, { useState, useEffect, useReducer } from 'react';
import { BrowserRouter as Router, Switch, Route, Link, useParams } from 'react-router-dom';
import './light.css';
import { Label, Button, Container, Divider, Dropdown, Form, Grid, Header, Icon, Image, Menu, Message, Segment, Table } from 'semantic-ui-react';
import moment from 'moment-timezone';
import { isAdmin, isInstructor, getInstructor, BasicTable, requester } from './utils.js';
import { NotFound, PleaseLogin } from './Misc.js';
import { InstructorClassDetail, InstructorClassAttendance } from './InstructorClasses.js';
import { PayPalPayNow } from './PayPal.js';
import { tags } from './Courses.js';

function ClassTable(props) {
	const { classes } = props;

	const now = new Date().toISOString();

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
						<Table.Row key={x.id} active={x.datetime < now || x.is_cancelled}>
							<Table.Cell>&nbsp;{x.course_data.name}</Table.Cell>
							<Table.Cell>
								<Link to={'/classes/'+x.id}>
									{moment.utc(x.datetime).tz('America/Edmonton').format('ll')}
								</Link>
							</Table.Cell>
							<Table.Cell>{x.is_cancelled ? 'Cancelled' : moment.utc(x.datetime).tz('America/Edmonton').format('LT')}</Table.Cell>
							<Table.Cell>{getInstructor(x)}</Table.Cell>
							<Table.Cell>{x.cost === '0.00' ? 'Free' : '$'+x.cost}</Table.Cell>
							<Table.Cell>
								{!!x.max_students ?
									x.max_students <= x.student_count ?
										'Full'
									:
										x.student_count + ' / ' + x.max_students
								:
									x.student_count
								}
							</Table.Cell>
						</Table.Row>
					)
				:
					<Table.Row><Table.Cell>None</Table.Cell></Table.Row>
				}
			</Table.Body>
		</Table>
	);
};

function NewClassTable(props) {
	const { classes } = props;

	let sortedClasses = [];
	if (classes.length) {
		for (const clazz of classes) {
			const course_data = clazz.course_data;
			const course = sortedClasses.find(x => x?.course?.id === course_data?.id);

			if (course) {
				course.classes.push(clazz);
			} else {
				sortedClasses.push({
					course: course_data,
					classes: [clazz],
				});
			}
		}
	}

	const now = new Date().toISOString();

	return (
		<>
			<div style={{ margin: '0 -1.5rem 0 -0.5rem', display: 'flex', flexWrap: 'wrap' }}>
				{sortedClasses.map(x =>
					<Segment style={{ margin: '1rem 1rem 0 0', width: '30rem' }}>
						<Header size='medium'>
							<Link to={'/courses/'+x.course.id}>
								{x.course.name}
							</Link>
						</Header>

						{!!x.course.tags && x.course.tags.split(',').map(name =>
							<Label color={tags[name]} tag>
								{name}
							</Label>
						)}


						<Table compact unstackable singleLine basic='very'>
							<Table.Header>
								<Table.Row>
									<Table.HeaderCell>Date</Table.HeaderCell>
									<Table.HeaderCell>Time</Table.HeaderCell>
									<Table.HeaderCell>Cost</Table.HeaderCell>
									<Table.HeaderCell>Students</Table.HeaderCell>
								</Table.Row>
							</Table.Header>

							<Table.Body>
								{x.classes.map(x =>
									<Table.Row key={x.id} active={x.datetime < now || x.is_cancelled}>
										<Table.Cell>
											<Link to={'/classes/'+x.id}>
												&nbsp;{moment.utc(x.datetime).tz('America/Edmonton').format('MMM Do')}
											</Link>
										</Table.Cell>

										<Table.Cell>
											{x.is_cancelled ? 'Cancelled' : moment.utc(x.datetime).tz('America/Edmonton').format('LT')}
										</Table.Cell>

										<Table.Cell>{x.cost === '0.00' ? 'Free' : '$'+x.cost}</Table.Cell>

										<Table.Cell>
											{!!x.max_students ?
												x.max_students <= x.student_count ?
													'Full'
												:
													x.student_count + ' / ' + x.max_students
											:
												x.student_count
											}
										</Table.Cell>
									</Table.Row>
								)}
							</Table.Body>
						</Table>
					</Segment>
				)}
			</div>
		</>
	);
};

let classesCache = false;
let sortCache = true;
let tagFilterCache = false;

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
	const [sortByCourse, setSortByCourse] = useState(sortCache);
	const [tagFilter, setTagFilter] = useState(tagFilterCache);
	const { token, user } = props;

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

	const byTeaching = (x) => x.instructor_id === user.member.id;
	const byDate = (a, b) => a.datetime > b.datetime ? 1 : -1;
	const byTag = (x) => tagFilter ? x.course_data.tags.includes(tagFilter) : true;

	console.log(tagFilter);

	return (
		<Container>
			<Header size='large'>Class List</Header>

			<p><Link to={'/courses'}>Click here to view the list of all courses.</Link></p>

			{!!user && !!classes.length && !!classes.filter(byTeaching).length &&
				<>
					<Header size='medium'>Classes You're Teaching</Header>
					<ClassTable classes={classes.slice().filter(byTeaching).sort(byDate)} />
				</>
			}

			<p>
				<Button
					onClick={() => {
						setSortByCourse(true);
						sortCache = true;
					}}
					active={sortByCourse}
				>
					Sort by course
				</Button>

				<Button
					onClick={() => {
						setSortByCourse(false);
						sortCache = false;
					}}
					active={!sortByCourse}
				>
					Sort by date
				</Button>
			</p>

			<p>
				Filter by tag:
				<div className='coursetags'>
					{Object.entries(tags).map(([name, color]) =>
						<Label
							onClick={() => {
								setTagFilter(name);
								tagFilterCache = name;
							}}
							as='a'
							color={color}
							tag
						>
							{name}
						</Label>
					)}
				</div>
			</p>
			<p>
				{tagFilter && <Button
					onClick={() => {
						setTagFilter(false);
						tagFilterCache = false;
					}}
				>
					Clear {tagFilter} filter
				</Button>}
			</p>


			{classes.length ?
				sortByCourse ?
					<NewClassTable classes={classes.filter(byTag)} />
				:
					<ClassTable classes={classes.slice().filter(byTag).sort(byDate)} />
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

