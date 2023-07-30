import React, { useState, useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import './light.css';
import { Button, Label, Container, Header, Segment, Table } from 'semantic-ui-react';
import moment from 'moment-timezone';
import { isInstructor, getInstructor, requester, useIsMobile } from './utils.js';
import { NotFound } from './Misc.js';
import { InstructorCourseList, InstructorCourseDetail } from './InstructorCourses.js';
import { InstructorClassList } from './InstructorClasses.js';

export const tags = {
	Protospace: 'black',
	Laser: 'red',
	Wood: 'brown',
	CNC: 'orange',
	Crafts: 'yellow',
	//name: 'olive',
	Electronics: 'green',
	Software: 'teal',
	Metal: 'blue',
	//name: 'violet',
	Event: 'purple',
	Outing: 'pink',
	Misc: 'grey',
};

let courseCache = false;
let tagFilterCache = false;

export function Courses(props) {
	const [courses, setCourses] = useState(courseCache);
	const [tagFilter, setTagFilter] = useState(tagFilterCache);
	const { token, user } = props;
	const isMobile = useIsMobile();

	useEffect(() => {
		requester('/courses/', 'GET', token)
		.then(res => {
			setCourses(res.results);
			courseCache = res.results;
		})
		.catch(err => {
			console.log(err);
		});
	}, []);

	const byTag = (x) => tagFilter ? x.tags.includes(tagFilter) : true;

	return (
		<Container>
			<Header size='large'>Courses</Header>

			{isInstructor(user) && <Segment padded>
				<InstructorCourseList courses={courses} setCourses={setCourses} {...props} />
			</Segment>}

			<p>Filter by tag:</p>

			<div className='coursetags'>
				<div
					className='labelbox'
					style={{borderColor: tagFilter === false ? 'black' : 'transparent'}}
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
						className='labelbox'
						style={{borderColor: tagFilter === name ? 'black' : 'transparent'}}
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

			{courses ?
				<Table basic='very'>
					{!isMobile && <Table.Header>
						<Table.Row>
							<Table.HeaderCell>Name</Table.HeaderCell>
							<Table.HeaderCell>Interest</Table.HeaderCell>
							<Table.HeaderCell></Table.HeaderCell>
						</Table.Row>
					</Table.Header>}

					<Table.Body>
						{courses.length ?
							courses.filter(byTag).map(x =>
								<Table.Row key={x.id}>
									<Table.Cell>
										<Link to={'/courses/'+x.id}>{x.name}</Link>
									</Table.Cell>
									<Table.Cell>
										{isMobile && 'Interest: '}{!!x.num_interested &&
											<>{x.num_interested} member{x.num_interested !== 1 && 's'}</>
										}
									</Table.Cell>
									<Table.Cell>
										{!!x.tags && x.tags.split(',').map(name =>
											<Label key={name} color={tags[name]} tag>
												{name}
											</Label>
										)}
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
	const [loading, setLoading] = useState(false);
	const { token, user, refreshUser } = props;
	const { id } = useParams();
	const isMobile = useIsMobile();

	const handleInterest = () => {
		if (loading) return;
		setLoading(true);
		const data = { course: course.id };
		requester('/interest/', 'POST', token, data)
		.then(res => {
			setError(false);
			refreshUser();
		})
		.catch(err => {
			console.log(err);
			setError(true);
		});
	};

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

	const now = new Date().toISOString();

	return (
		<Container>
			{!error ?
				course ?
					<div>
						<Header size='large'>{course.name}</Header>

						<p>
							{!!course.tags && course.tags.split(',').map(name =>
								<Label key={name} color={tags[name]} tag size='small'>
									{name}
								</Label>
							)}
						</p>

						{user &&
							<p>
								{user.interests.filter(x => !x.satisfied_by).map(x => x.course).includes(course.id) ?
									'Interested ✅'
								:
									<Button
										size='tiny'
										loading={loading}
										onClick={handleInterest}
									>
										Interest&nbsp;+
									</Button>
								}
							</p>
						}

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
							{!isMobile && <Table.Header>
								<Table.Row>
									<Table.HeaderCell>Date</Table.HeaderCell>
									<Table.HeaderCell>Time</Table.HeaderCell>
									<Table.HeaderCell>Instructor</Table.HeaderCell>
									<Table.HeaderCell>Cost</Table.HeaderCell>
									<Table.HeaderCell>Students</Table.HeaderCell>
								</Table.Row>
							</Table.Header>}

							<Table.Body>
								{course.sessions.length ?
									course.sessions.sort((a, b) => a.datetime < b.datetime ? 1 : -1).map(x =>
										<Table.Row key={x.id} active={x.datetime < now || x.is_cancelled}>
											<Table.Cell>
												<Link to={'/classes/'+x.id}>
													{!isMobile && <span>&nbsp;</span>}{moment.utc(x.datetime).tz('America/Edmonton').format('ll')}
												</Link>
											</Table.Cell>
											<Table.Cell>{isMobile && 'Time: '}{x.is_cancelled ? 'Cancelled' : moment.utc(x.datetime).tz('America/Edmonton').format('LT')}</Table.Cell>
											<Table.Cell>{isMobile && 'Instructor: '}{getInstructor(x)}</Table.Cell>
											<Table.Cell>{isMobile && 'Cost: '}{x.cost === '0.00' ? 'Free' : '$'+x.cost}</Table.Cell>
											<Table.Cell>
												{isMobile && 'Students: '}{!!x.max_students ?
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
					</div>
				:
					<p>Loading...</p>
			:
				<NotFound />
			}
		</Container>
	);
};

