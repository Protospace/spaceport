import React, { useState, useEffect, useReducer } from 'react';
import { Link, useParams } from 'react-router-dom';
import './light.css';
import { Label, Button, Container, Dropdown, Form, FormField, Header, Icon, Input, Segment, Table } from 'semantic-ui-react';
import moment from 'moment-timezone';
import { apiUrl, isAdmin, getInstructor, getInstructorDiscourseLink, BasicTable, requester, useIsMobile } from './utils.js';
import { NotFound } from './Misc.js';
import { InstructorClassDetail, InstructorClassAttendance } from './InstructorClasses.js';
import { PayPalPayNow } from './PayPal.js';
import { PayWithProtocoin } from './Paymaster.js';
import { tags } from './Courses.js';

function ClassTable(props) {
	const { classes } = props;
	const isMobile = useIsMobile();

	const now = new Date().toISOString();

	return <>
		<p>{classes.length} result{classes.length === 1 ? '' : 's'}:</p>
		{isMobile ?
		<Table basic='very'>

			<Table.Body>
				{classes.length ?
					classes.map(x =>
						<Table.Row key={x.id} active={x.datetime < now || x.is_cancelled}>
							<Table.Cell>{x.course_data.name}</Table.Cell>
							<Table.Cell>
								<Link to={'/classes/'+x.id}>
									{moment.utc(x.datetime).tz('America/Edmonton').format('ddd, ll')}
								</Link>
								<span style={{float: 'right'}}>
									Time: {x.is_cancelled ? 'Cancelled' : moment.utc(x.datetime).tz('America/Edmonton').format('LT')}
								</span>
							</Table.Cell>
							<Table.Cell>
								Cost: {x.cost === '0.00' ? 'Free' : '$'+x.cost}
								<span style={{float: 'right'}}>
									Students: {!!x.max_students ?
										x.max_students <= x.student_count ?
											'Full'
										:
											x.student_count + ' / ' + x.max_students
									:
										x.student_count
									}
								</span>
							</Table.Cell>
							<Table.Cell>Instructor: {getInstructor(x)}</Table.Cell>
						</Table.Row>
					)
				:
					<Table.Row>None</Table.Row>
				}
			</Table.Body>
		</Table>
	:
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
									{moment.utc(x.datetime).tz('America/Edmonton').format('ddd, ll')}
								</Link>
							</Table.Cell>
							<Table.Cell>{x.is_cancelled ? 'Cancelled' : moment.utc(x.datetime).tz('America/Edmonton').format('LT')}</Table.Cell>
							<Table.Cell>{getInstructor(x)}</Table.Cell>
							<Table.Cell>{x.cost === '0.00' ? 'Free' : '$'+x.cost}</Table.Cell>
							<Table.Cell>
								{!!x.max_students ?
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
	}
	</>;
};

function NewClassTableCourse(props) {
	const {course, classes, token, user, refreshUser} = props;
	const [error, setError] = useState(false);
	const [loading, setLoading] = useState(false);
	const [interested, setInterested] = useState(course.num_interested || 0);

	const handleInterest = () => {
		if (loading) return;
		setLoading(true);
		const data = { course: course.id };
		requester('/interest/', 'POST', token, data)
		.then(res => {
			setError(false);
			refreshUser();
			setInterested(interested+1);
		})
		.catch(err => {
			console.log(err);
			setError(true);
		});
	};

	const now = new Date().toISOString();

	return (
		<Segment style={{ margin: '1rem 1rem 0 0', width: '22rem' }}>
			<Header size='small'>
				<Link to={'/courses/'+course.id}>
					{course.name}
				</Link>
			</Header>

			<div className='byline'>
				<div className='tags'>
					{!!course.tags && course.tags.split(',').map(name =>
						<Label key={name} color={tags[name]} tag size='small'>
							{name}
						</Label>
					)}
				</div>

				{user &&
					<div className='interest'>
						{user.interests.filter(x => !x.satisfied_by).map(x => x.course).includes(course.id) ?
							<div
								className='nonbutton'
							>
								{interested} interested <span className='dark-emoji'>✅</span>
							</div>
						:
							<Button
								size='tiny'
								loading={loading}
								onClick={handleInterest}
							>
								{interested} interested
							</Button>
						}
					</div>
				}
			</div>

			{error && <p>Error.</p>}

			{classes ?
				<Table compact unstackable singleLine basic='very'>
					<Table.Header>
						<Table.Row>
							<Table.HeaderCell>Date</Table.HeaderCell>
							<Table.HeaderCell>Cost</Table.HeaderCell>
							<Table.HeaderCell>Students</Table.HeaderCell>
						</Table.Row>
					</Table.Header>

					<Table.Body>
						{classes.map(x =>
							<Table.Row key={x.id} active={x.datetime < now || x.is_cancelled}>
								<Table.Cell>
									<Link to={'/classes/'+x.id}>
										{moment.utc(x.datetime).tz('America/Edmonton').format(' MMM Do')}
									</Link>
									{' - '}{x.is_cancelled ? 'Cancelled' : moment.utc(x.datetime).tz('America/Edmonton').format('LT')}
								</Table.Cell>

								<Table.Cell>{x.cost === '0.00' ? 'Free' : '$'+x.cost.slice(0,-3)}</Table.Cell>

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
			:
				<>
					<p/>
					<p>No upcoming classes.</p>
				</>
			}
		</Segment>
	);
}

function NewClassTable(props) {
	const { classes, courses, token, user, refreshUser } = props;

	let sortedClasses = [];
	let seenCourseIds = [];

	// this hacky mess ensures courses with classes are displayed first, then all the remaining courses
	// while still maintaining the order they were sent by the server
	if (classes.length && courses.length) {
		for (const clazz of classes) {
			const course_data = clazz.course_data;
			const course = sortedClasses.find(x => x?.course?.id === course_data?.id);

			if (course) {
				course.classes.push(clazz);
			} else {
				const full_course = courses.find(x => x.id === course_data.id);
				if (full_course) {
					sortedClasses.push({
						course: full_course,
						classes: [clazz],
					});
					seenCourseIds.push(
						course_data.id
					);
				}
			}
		}
	}

	return (
		<>
			<div className='newclasstable'>
				{sortedClasses.map(x =>
					<NewClassTableCourse
						key={x.course.id}
						course={x.course}
						classes={x.classes}
						token={token}
						user={user}
						refreshUser={refreshUser}
					/>
				)}

				{courses.filter(x => !seenCourseIds.includes(x.id)).map(x =>
					<NewClassTableCourse
						key={x.id}
						course={x}
						classes={false}
						token={token}
						user={user}
						refreshUser={refreshUser}
					/>
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

			<p style={{ marginBottom: '30rem' }}/>
		</Container>
	);
};

export function Classes(props) {
	const [classes, setClasses] = useState(classesCache);
	const [courses, setCourses] = useState(false);
	const [loading, setLoading] = useState(false);
	const [search, setSearch] = useState('');
	const [sortByCourse, setSortByCourse] = useState(sortCache);
	const [tagFilter, setTagFilter] = useState(tagFilterCache);
	const { token, user, refreshUser } = props;

	useEffect(() => {
		requester('/courses/', 'GET', token)
		.then(res => {
			setCourses(res.results);
		})
		.catch(err => {
			console.log(err);
		});
	}, []);

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

	const loadAll = () => {
		if (loading) return;
		setLoading(true);
		requester('/sessions/all/', 'GET', token)
		.then(res => {
			setLoading(false);
			setClasses(res.results);
			classesCache = res.results;
			window.scrollTo(0, 0);
		})
		.catch(err => {
			setLoading(false);
			console.log(err);
		});
	};

	const byTeaching = (x) => x.instructor_id === user.member.id;
	const byDate = (a, b) => a.datetime > b.datetime ? 1 : -1;
	const classesByTag = (x) => tagFilter ? x.course_data.tags.includes(tagFilter) : true;
	const coursesByTag = (x) => tagFilter ? x.tags.includes(tagFilter) : true;
	const classesBySearch = (x) => search ? x.instructor_name.toLowerCase().includes(search.toLowerCase()) || x.course_data.name.toLowerCase().includes(search.toLowerCase()) : true;
	const coursesBySearch = (x) => search ? x.name.toLowerCase().includes(search.toLowerCase()) : true;
	const archivedCourses = (x) => !x.is_archived;

	return (
		<Container>
			<Header size='large'>Class List</Header>

			<p><Link to={'/courses'}>View the list of all courses.</Link></p>

			{!!user && !!classes.length && !!classes.filter(byTeaching).length &&
				<>
					<Header size='medium'>Classes You're Teaching</Header>
					<ClassTable classes={classes.slice().filter(byTeaching).sort(byDate)} />
				</>
			}

			<div>
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

				<Input focus icon='search'
					placeholder='Search...'
					value={search}
					onChange={(event) => setSearch(event.target.value)}
					aria-label='search products'
					style={{ margin: '0.5rem 0.5rem 0.5rem 0' }}
				/>

				{!!search.length &&
					<Button
						content='Clear'
						onClick={() => setSearch('')}
					/>
				}
			</div>

			<p>Filter by tag:</p>

			<div className='coursetags'>
				<div
					className={tagFilter === false ? 'labelbox-selected' : 'labelbox'}
				>
					<Label
						onClick={() => {
							setTagFilter(false);
							tagFilterCache = false;
						}}
						as='a'
						tag
					>
						No Filter
					</Label>
				</div>

				{Object.entries(tags).map(([name, color]) =>
					<div
						key={name}
						className={tagFilter === name ? 'labelbox-selected' : 'labelbox'}
					>
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
					</div>
				)}
			</div>

			{classes.length && courses.length ?
				sortByCourse ?
					<NewClassTable
						classes={classes.filter(classesByTag).filter(classesBySearch)}
						courses={courses.filter(coursesByTag).filter(coursesBySearch).filter(archivedCourses)}
						token={token}
						user={user}
						refreshUser={refreshUser}
					/>
				:
					<>
					<ClassTable classes={classes.slice().filter(classesByTag).filter(classesBySearch).sort(byDate)} />

					<Button
						onClick={loadAll}
						loading={loading}
					>
						Load all (slow)
					</Button>
					</>
			:
				<p>Loading...</p>
			}
		</Container>
	);
};


export function ICalButtons(props) {
	const { token, clazz } = props;
	const [loading, setLoading] = useState(false);
	const [success, setSuccess] = useState(false);
	const [error, setError] = useState(false);

	const handleDownload = (e) => {
		e.preventDefault();
		window.location = apiUrl + '/sessions/' + clazz.id + '/download_ical/';
	}

	const handleEmail = (e) => {
		e.preventDefault();
		if (loading) return;
		setLoading(true);
		setSuccess(false);
		requester('/sessions/' + clazz.id + '/email_ical/', 'POST', token, {})
		.then(res => {
			setLoading(false);
			setSuccess(true);
		})
		.catch(err => {
			setLoading(false);
			console.log(err);
			setError(true);
		});
	};

	const addToGoogleCalendar = (e) => {
		e.preventDefault();

		// construct and set the dates format that google calendar links require
		let starttime = moment(clazz.datetime);
		let endtime = starttime.clone().add(1, 'hour');
		const datestringfmt = 'YYYYMMDDTkkmmss';
		let dates = `${starttime.format(datestringfmt)}/${endtime.format(datestringfmt)}`

		// send user to google calendar
		window.location = `https://www.google.com/calendar/render?action=TEMPLATE&text=${clazz.course_data.name}&dates=${dates}`;
	};

	const options = [
		{ key: 'email', icon: 'mail outline', text: 'Email ICS Event', value: 'Email', action: handleEmail },
		{ key: 'download', icon: 'download', text: 'Download ICS Event', value: 'Download', action: handleDownload },
		{ key: 'google', icon: 'google', text: 'Add to Google Calendar', value: 'Google', action: addToGoogleCalendar },
	];

	// get default option from local storage or default to first item in options list
	const calendarValue = localStorage.getItem('calendarPreference') || 'Email';
	const defaultOption = options.find(x => x.value === calendarValue);

	const [selectedOption, setOption] = useState(defaultOption);

	const onChange = (e, data) => {
		const newOption = options.find(x => x.value === data.value);
		setOption(newOption);

		// set the option as users preference
		localStorage.setItem('calendarPreference', newOption.value);
	};

	return (
		<>
		{success ?
			<span>Sent!</span>
		:
			<Button.Group>
				<Button
					loading={loading}
					onClick={selectedOption.action}
				>
					<Icon name={selectedOption.icon} />{selectedOption.value}
				</Button>
				<Dropdown
					className='button icon'
					floating
					onChange={onChange}
					options={options}
					trigger={<></>}
					selectOnBlur={false}
				/>
			</Button.Group>
		}
		{error && <p>Error.</p>}
		</>
	);
};

export function Class(props) {
	const { token, user, refreshUser, clazz, setClass, refreshClass } = props;
	const [error, setError] = useState(false);
	const [loading, setLoading] = useState(false);
	const [override, setOverride] = useState(false);
	const [check1, setCheck1] = useState(false);
	const [check2, setCheck2] = useState(false);
	const [check3, setCheck3] = useState(false);
	const { id } = useParams();
	const userTraining = clazz && clazz.students.find(x => x.user === user.id);

	const handleSignup = () => {
		if (loading) return;
		setLoading(true);
		const data = { attendance_status: 'Waiting for payment', session: id };
		requester('/training/', 'POST', token, data)
		.then(res => {
			refreshClass();
			refreshUser();
			setError(false);
		})
		.catch(err => {
			setLoading(false);
			console.log(err);
			setError(err.data.non_field_errors);
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
			setError(false);
		})
		.catch(err => {
			setLoading(false);
			console.log(err);
			setError(err.data.non_field_errors);
		});
	};

	useEffect(() => {
		setLoading(false);
	}, [userTraining]);

	const now = new Date().toISOString();
	const isEvent = clazz && /Event|Outing|Protospace/.test(clazz.course_data.tags);
	const isOld = clazz && clazz.datetime < now;
	const isFree = clazz && clazz.cost === '0.00';

	return (<>
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
					<Table.Cell>
						{getInstructor(clazz)}{' '}
						{getInstructorDiscourseLink(clazz) && <>{'— '}<a href={getInstructorDiscourseLink(clazz)} target='_blank'>[message]</a></>}
					</Table.Cell>
				</Table.Row>
				<Table.Row>
					<Table.Cell>Cost:</Table.Cell>
					<Table.Cell>{clazz.cost === '0.00' ? 'Free' : '$'+clazz.cost}</Table.Cell>
				</Table.Row>
				<Table.Row>
					<Table.Cell>Students:</Table.Cell>
					<Table.Cell>{clazz.student_count} {!!clazz.max_students && '/ '+clazz.max_students}</Table.Cell>
				</Table.Row>
				<Table.Row>
					<Table.Cell>Event:</Table.Cell>
					<Table.Cell><ICalButtons token={token} clazz={clazz} /></Table.Cell>
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

		{clazz.instructor !== user.id &&
			(userTraining ?
				<div>
					<p>Status: {userTraining.attendance_status}</p>

					{!isEvent && !['Withdrawn', 'Rescheduled'].includes(userTraining.attendance_status) && <p>
						You are registered for this class. Some things to know:

						<ul>
							<li>Your spot is reserved.</li>
							<li>You can contact the instructor with the [message] link by their name above.</li>
							<li>Plan to arrive 5 minutes early, the class will start on time.</li>
						</ul>
					</p>}

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

						{error && <Form><FormField>
							<Label pointing prompt>
								{error}
							</Label>
						</FormField></Form>}
					</p>

					{clazz.cost !== '0.00' && !userTraining.paid_date && userTraining.attendance_status !== 'Withdrawn' &&
						<div>
							{userTraining.attendance_status === 'Waiting for payment' ?
								<p>Please pay the course fee of ${clazz.cost}:</p>
							:
								<p>In case you haven't paid the course fee of ${clazz.cost} yet, you can do that here:</p>
							}
							<PayPalPayNow
								amount={clazz.cost}
								name={clazz.course_data.name}
								custom={JSON.stringify({ training: userTraining.id })}
							/>

							<p/>

							<p>Current <Link to='/paymaster'>Protocoin</Link> balance: ₱&thinsp;{user.member.protocoin.toFixed(2)}</p>

							<PayWithProtocoin
								token={token} user={user} refreshUser={refreshUser}
								amount={clazz.cost}
								onSuccess={() => {
									refreshUser();
									refreshClass();
								}}
								custom={{ category: 'OnAcct', training: userTraining.id }}
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
						<>
							{clazz.datetime < now ?
								<>
									<p>This class has already ran.</p>
									<p>
										<Form.Checkbox
											name='override'
											value={override}
											label='Let me sign up anyway'
											onChange={(e, v) => setOverride(v.checked)}
										/>
									</p>

									<Button loading={loading} onClick={handleSignup} disabled={isOld && !override}>
										Register
									</Button>

									{error && <Form><FormField>
										<Label pointing prompt>
											{error}
										</Label>
									</FormField></Form>}
								</>
							:
								<>
									{!isEvent && <>
										<p>
											<Form.Checkbox
												name='check1'
												value={check1}
												label='I understand that instructors are unpaid volunteers and I will actually attend'
												onChange={(e, v) => setCheck1(v.checked)}
											/>
										</p>

										<p>
											<Form.Checkbox
												name='check2'
												value={check2}
												label='I promise to inform the instructor if I’m unable to attend or running late'
												onChange={(e, v) => setCheck2(v.checked)}
											/>
										</p>

										{!isFree && <p>
											<Form.Checkbox
												name='check3'
												value={check3}
												label={'I\'m ready to pay the class fee of $' + clazz.cost}
												onChange={(e, v) => setCheck3(v.checked)}
											/>
										</p>}
									</>}

									<Button loading={loading} onClick={handleSignup} disabled={(!check1 || !check2 || (!check3 && !isFree)) && !isEvent}>
										Register
									</Button>

									{error && <Form><FormField>
										<Label pointing prompt>
											{error}
										</Label>
									</FormField></Form>}
								</>
							}
						</>
					)
				)
			)
		}
	</>);
};

export function ClassDetail(props) {
	const [clazz, setClass] = useState(false);
	const [refreshCount, refreshClass] = useReducer(x => x + 1, 0);
	const [error, setError] = useState(false);
	const { token, user, refreshUser } = props;
	const { id } = useParams();

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

	return (
		<Container>
			{!error ?
				clazz ?
					<div>
						<Header size='large'>Class Details</Header>

						<Class token={token} user={user} refreshUser={refreshUser} clazz={clazz} setClass={setClass} refreshClass={refreshClass} />
					</div>
				:
					<p>Loading...</p>
			:
				<NotFound />
			}
		</Container>
	);
};
