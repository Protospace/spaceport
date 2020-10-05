import React, { useState, useEffect, useRef } from 'react';
import { BrowserRouter as Router, Switch, Route, Link, useParams, useHistory } from 'react-router-dom';
import ReactToPrint from 'react-to-print';
import * as Datetime from 'react-datetime';
import 'react-datetime/css/react-datetime.css';
import moment from 'moment-timezone';
import './light.css';
import { Button, Container, Checkbox, Divider, Dropdown, Form, Grid, Header, Icon, Image, Label, Menu, Message, Segment, Table } from 'semantic-ui-react';
import { BasicTable, staticUrl, requester } from './utils.js';
import { MembersDropdown } from './Members.js';

class AttendanceSheet extends React.Component {
	render() {
		const clazz = this.props.clazz;
		const num = clazz.students.length;

		return (
			<div style={{ padding: '3rem' }}>
				<Header size='medium'>{clazz.course_name} Attendance</Header>
				<p>
					{moment.utc(clazz.datetime).tz('America/Edmonton').format('llll')}
					{num >= 2 ? ', '+num+' students sorted by registration time.' : '.'}
				</p>

				<Grid stackable padded columns={2}>
					<Grid.Column>
						<Table collapsing unstackable basic='very'>
							{clazz.students
								.filter(x => x.attendance_status !== 'Withdrawn')
								.slice(0, 15)
								.map(x =>
									<Table.Row key={x.id}>
										<Table.Cell>
											<Icon name='square outline' size='large' />
										</Table.Cell>
										<Table.Cell>
											{x.student_name}
										</Table.Cell>
									</Table.Row>
								)
							}
						</Table>
					</Grid.Column>
					<Grid.Column>
						<Table collapsing unstackable basic='very'>
							{clazz.students
								.filter(x => x.attendance_status !== 'Withdrawn')
								.slice(15)
								.map(x =>
									<Table.Row key={x.id}>
										<Table.Cell>
											<Icon name='square outline' size='large' />
										</Table.Cell>
										<Table.Cell>
											{x.student_name}
										</Table.Cell>
									</Table.Row>
								)
							}
						</Table>
					</Grid.Column>
				</Grid>
			</div>
		);
	}
}

function AttendanceRow(props) {
	const { student, token, refreshClass } = props;
	const [error, setError] = useState(false);
	const [loading, setLoading] = useState(false);

	const handleMark = (newStatus) => {
		if (loading) return;
		if (student.attendance_status == newStatus) return;
		setLoading(newStatus);
		const data = { ...student, attendance_status: newStatus };
		requester('/training/'+student.id+'/', 'PATCH', token, data)
		.then(res => {
			refreshClass();
			setError(false);
		})
		.catch(err => {
			console.log(err);
			setError(true);
		});
	};

	const makeProps = (name) => ({
		onClick: () => handleMark(name),
		toggle: true,
		active: student.attendance_status === name,
		loading: loading === name,
	});

	useEffect(() => {
		setLoading(false);
	}, [student.attendance_status]);

	return (
		<div className='attendance-row'>
			<p>
				<Link to={'/members/'+student.student_id}>{student.student_name}</Link>
				{student.attendance_status === 'Waiting for payment' && ' (Waiting for payment)'}:
			</p>

			<Button {...makeProps('Withdrawn')}>
				Withdrawn
			</Button>

			<Button {...makeProps('Confirmed')}>
				Confirmed
			</Button>

			<Button {...makeProps('Rescheduled')}>
				Rescheduled
			</Button>

			<Button {...makeProps('No-show')}>
				No-show
			</Button>

			<Button {...makeProps('Attended')}>
				Attended
			</Button>

			{error && <p>Error: something went wrong!</p>}

		</div>
	);
}

export function InstructorClassAttendance(props) {
	const { clazz, token, refreshClass, user } = props;
	const [open, setOpen] = useState(false);
	const [input, setInput] = useState({});
	const [error, setError] = useState(false);
	const [loading, setLoading] = useState(false);
	const printRef = useRef();

	const handleValues = (e, v) => setInput({ ...input, [v.name]: v.value });

	const handleSubmit = (e) => {
		if (loading) return;
		setLoading(true);
		const data = { ...input, attendance_status: 'Attended', session: clazz.id };
		requester('/training/', 'POST', token, data)
		.then(res => {
			setLoading(false);
			setError(false);
			refreshClass();
		})
		.catch(err => {
			setLoading(false);
			console.log(err);
			setError(err.data);
		});
	};

	return (
		<div>
			<Header size='medium'>Instructor Panel</Header>

			{open || clazz.instructor === user.id ?
				<div>
					<Header size='small'>Student Emails</Header>

					{clazz.students.length ?
						clazz.students
							.filter(x => x.attendance_status !== 'Withdrawn')
							.map(x => x.student_email)
							.join('; ')
					:
						<p>No students yet.</p>
					}

					<Header size='small'>Mark Attendance</Header>

					{!!clazz.students.length && <div>
						<div style={{ display: 'none' }}>
							<AttendanceSheet clazz={clazz} ref={printRef} />
						</div>
						<ReactToPrint
							trigger={() => <Button>Print Attendance Sheet</Button>}
							content={() => printRef.current}
						/>
					</div>}

					{clazz.students.length ?
						clazz.students.map(x =>
							<AttendanceRow key={x.id} student={x} {...props} />
						)
					:
						<p>No students yet.</p>
					}

					<Header size='small'>Add Student</Header>

					<Form onSubmit={handleSubmit}>
						<Form.Field error={error.member_id}>
							<MembersDropdown
								name='member_id'
								value={input.member_id}
								token={token}
								onChange={handleValues}
								initial='Find a member'
							/>
						</Form.Field>

						<Form.Button loading={loading} error={error.non_field_errors}>
							Submit
						</Form.Button>
					</Form>
				</div>
			:
				<Button onClick={() => setOpen(true)}>
					Edit Attendance
				</Button>
			}
		</div>
	);
};

function InstructorClassEditor(props) {
	const { input, setInput, error, editing } = props;

	const handleValues = (e, v) => setInput({ ...input, [v.name]: v.value });
	const handleUpload = (e, v) => setInput({ ...input, [v.name]: e.target.files[0] });
	const handleChange = (e) => handleValues(e, e.currentTarget);
	const handleCheck = (e, v) => setInput({ ...input, [v.name]: v.checked });
	const handleDatetime = (v) => setInput({ ...input, datetime: v.utc().format() });

	const makeProps = (name) => ({
		name: name,
		onChange: handleChange,
		value: input[name] || '',
		error: error[name],
	});

	return (
		<div className='class-editor'>
			<Form.Input
				label='Cost ($) — 0 for free'
				{...makeProps('cost')}
			/>

			<Form.Input
				label='Max Students — Blank for Unlimited'
				{...makeProps('max_students')}
			/>

			<Form.Field>
				<label>Time and Date</label>
				<Datetime
					timeConstraints={{ minutes: { step: 15 } }}
					value={ input.datetime ? moment.utc(input.datetime).tz('America/Edmonton') : (new Date()).setMinutes(0) }
					onChange={handleDatetime}
				/>
				{error.datetime &&
					<Label pointing prompt>
						{error.datetime}
					</Label>
				}
			</Form.Field>

			{editing && <Form.Field>
				<label>Is the class cancelled?</label>
				<Checkbox
					label='Yes'
					name='is_cancelled'
					onChange={handleCheck}
					checked={input.is_cancelled}
				/>
			</Form.Field>}

		</div>
	);
}

export function InstructorClassDetail(props) {
	const { clazz, setClass, token } = props;
	const [open, setOpen] = useState(false);
	const [input, setInput] = useState(clazz);
	const [error, setError] = useState(false);
	const [loading, setLoading] = useState(false);
	const [success, setSuccess] = useState(false);
	const { id } = useParams();

	const handleSubmit = (e) => {
		if (loading) return;
		setLoading(true);
		setSuccess(false);
		requester('/sessions/'+id+'/', 'PUT', token, input)
		.then(res => {
			setSuccess(true);
			setLoading(false);
			setError(false);
			setOpen(false);
			setClass(res);
		})
		.catch(err => {
			setLoading(false);
			console.log(err);
			setError(err.data);
		});
	};

	return (
		<div>
			<Header size='medium'>Instructor Panel</Header>

			{!open && success && <p>Saved!</p>}

			{open ?
				<Form onSubmit={handleSubmit}>
					<Header size='small'>Edit Class</Header>

					<InstructorClassEditor editing input={input} setInput={setInput} error={error} />

					<Form.Button loading={loading} error={error.non_field_errors}>
						Submit
					</Form.Button>
				</Form>
			:
				<Button onClick={() => setOpen(true)}>
					Edit Class
				</Button>
			}
		</div>
	);
};

export function InstructorClassList(props) {
	const { course, setCourse, token } = props;
	const [open, setOpen] = useState(false);
	const [input, setInput] = useState({});
	const [error, setError] = useState(false);
	const [loading, setLoading] = useState(false);
	const [success, setSuccess] = useState(false);
	const [classes, setClasses] = useState([]);
	const [sameClasses, setSameClasses] = useState(false);

	const handleSubmit = (e) => {
		if (loading) return;
		setLoading(true);
		setSuccess(false);
		const data = { ...input, course: course.id };
		requester('/sessions/', 'POST', token, data)
		.then(res => {
			setSuccess(res.id);
			setInput({});
			setLoading(false);
			setError(false);
			setOpen(false);
			setCourse({ ...course, sessions: [ res, ...course.sessions ] });
		})
		.catch(err => {
			setLoading(false);
			console.log(err);
			setError(err.data);
		});
	};

	useEffect(() => {
		requester('/sessions/', 'GET', token)
		.then(res => {
			setClasses(res.results.filter(x => !x.is_cancelled));
		})
		.catch(err => {
			console.log(err);
		});
	}, []);

	useEffect(() => {
		setSameClasses(classes.filter(x =>
			moment.utc(x.datetime).tz('America/Edmonton').isSame(input.datetime, 'day')
		).sort((a, b) => a.datetime > b.datetime ? 1 : -1));
	}, [input.datetime]);

	return (
		<div>
			<Header size='medium'>Instructor Panel</Header>

			{!open && success && <p>Added! <Link to={'/classes/'+success}>View the class.</Link></p>}

			{open ?
				<Grid stackable padded columns={2}>
					<Grid.Column>
						<Form onSubmit={handleSubmit}>
							<Header size='small'>Add a Class</Header>

							<InstructorClassEditor input={input} setInput={setInput} error={error} />

							<Form.Button loading={loading} error={error.non_field_errors}>
								Submit
							</Form.Button>
						</Form>
					</Grid.Column>
					<Grid.Column>
						{!!input.datetime &&
							<div>
								<Header size='small'>Upcoming Classes That Day</Header>

								{sameClasses.length ?
									sameClasses.map(x =>
										<p>
											{moment.utc(x.datetime).tz('America/Edmonton').format('LT')} — {x.course_name}
										</p>
									)
								:
									<p>None</p>
								}
							</div>
						}
					</Grid.Column>
				</Grid>
			:
				<Button onClick={() => setOpen(true)}>
					Add a Class
				</Button>
			}
		</div>
	);
};
