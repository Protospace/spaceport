import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Switch, Route, Link, useParams } from 'react-router-dom';
import './light.css';
import { Button, Label, Container, Divider, Dropdown, Form, Grid, Header, Icon, Image, Menu, Message, Segment, Table } from 'semantic-ui-react';
import moment from 'moment-timezone';
import { isInstructor, getInstructor, requester } from './utils.js';
import { NotFound, PleaseLogin } from './Misc.js';
import { InstructorCourseList, InstructorCourseDetail } from './InstructorCourses.js';
import { InstructorClassList } from './InstructorClasses.js';

export const tags = {
	Protospace: 'black',
	Laser: 'red',
	Wood: 'brown',
	CNC: 'orange',
	Niche: 'yellow',
	//name: 'olive',
	Electronics: 'green',
	Computers: 'teal',
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

			{courses ?
				<Table basic='very'>
					<Table.Header>
						<Table.Row>
							<Table.HeaderCell>Name</Table.HeaderCell>
							<Table.HeaderCell></Table.HeaderCell>
						</Table.Row>
					</Table.Header>

					<Table.Body>
						{courses.length ?
							courses.filter(byTag).map(x =>
								<Table.Row key={x.id}>
									<Table.Cell>
										<Link to={'/courses/'+x.id}>{x.name}</Link>
									</Table.Cell>
									<Table.Cell>
										{!!x.tags && x.tags.split(',').map(name =>
											<Label color={tags[name]} tag>
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
									course.sessions.sort((a, b) => a.datetime < b.datetime ? 1 : -1).slice(0,10).map(x =>
										<Table.Row key={x.id}>
											<Table.Cell>
												<Link to={'/classes/'+x.id}>
													{moment.utc(x.datetime).tz('America/Edmonton').format('ll')}
												</Link>
											</Table.Cell>
											<Table.Cell>{x.is_cancelled ? 'Cancelled' : moment.utc(x.datetime).tz('America/Edmonton').format('LT')}</Table.Cell>
											<Table.Cell>{getInstructor(x)}</Table.Cell>
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

