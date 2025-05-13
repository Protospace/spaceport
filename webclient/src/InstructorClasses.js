import React, { useState, useEffect, useRef } from 'react';
import { Link, useParams } from 'react-router-dom';
import ReactToPrint from 'react-to-print';
import * as Datetime from 'react-datetime';
import 'react-datetime/css/react-datetime.css';
import moment from 'moment-timezone';
import './light.css';
import { Button, Checkbox, Form, Grid, Header, Icon, Label, Message, Table } from 'semantic-ui-react';
import { requester, randomString } from './utils.js';
import { MembersDropdown } from './Members.js';

class AttendanceSheet extends React.Component {
	render() {
		const clazz = this.props.clazz;
		const num = clazz.students.length;

		return (
			<div style={{ padding: '3rem', background: 'white', width: '100%', height: '100%' }}>
				<Header size='medium'>{clazz.course_data.name} Attendance</Header>
				<p>
					{moment.utc(clazz.datetime).tz('America/Edmonton').format('llll')}
					{num >= 2 ? ', '+num+' students sorted by registration time.' : '.'}
				</p>

				<Grid stackable padded columns={2}>
					<Grid.Column>
						<Table collapsing unstackable basic='very'>
							{clazz.students
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
	const [refundLoading, setRefundLoading] = useState(false);
	const [refundError, setRefundError] = useState(false);

	const handleMark = (newStatus) => {
		if (loading || refundLoading) return;
		if (student.attendance_status === newStatus) return;
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

	const handleRefund = () => {
		if (loading || refundLoading) return;
		setRefundLoading(true);
		setRefundError(false);
		requester(`/training/${student.id}/refund/`, 'POST', token)
		.then(res => {
			refreshClass();
			setRefundError(false);
		})
		.catch(err => {
			console.log(err);
			setRefundError(err.data?.non_field_errors || 'Something went wrong.');
		})
		.finally(() => {
			setRefundLoading(false);
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
		// We don't reset refundLoading here as it's managed by its own finally block
	}, [student.attendance_status]);

	return (
		<div className='attendance-row'>
			<p>
				<Link to={'/members/'+student.student_id}>{student.student_name}</Link>
				{student.paid_date &&
					<>
						{' | Paid '}
						<Button
							onClick={handleRefund}
							loading={refundLoading}
						disabled={loading}
						negative
						compact
						size='mini'
					>
						Refund
					</Button>
					</>
				}
				{student.attendance_status === 'Waiting for payment' && ' (Waiting for payment)'}:
			</p>

			{refundError && <Message error content={refundError} />}

			<Button {...makeProps('Withdrawn')}>
				Withdrawn
			</Button>

			<Button {...makeProps('Confirmed')}>
				Confirmed
			</Button>

			<Button {...makeProps('Rescheduled')}>
				Rescheduled
			</Button>

			<Button {...makeProps('Try-again')}>
				Try-again
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

let attendanceOpenCache = false;

export function InstructorClassAttendance(props) {
	const { clazz, token, refreshClass, user } = props;
	const [open, setOpen] = useState(attendanceOpenCache);
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

					{!!clazz.students.length && <div style={{marginBottom: '1rem'}}>
						<div style={{ display: 'none' }}>
							<AttendanceSheet clazz={clazz} ref={printRef} />
						</div>
						<ReactToPrint
							trigger={() => <Button>Print Attendance Sheet</Button>}
							content={() => printRef.current}
						/>
					</div>}

					<p>
						Legend:<br/>
						<b>Withdrawn:</b> withdrew from class, contacted ahead of time<br/>
						<b>Confirmed:</b> confirmed to be attending the class (and paid)<br/>
						<b>Rescheduled:</b> needs to take a different time / class cancelled<br/>
						<b>Try-again:</b> attended, but failed to learn the course material<br/>
						<b>No-show:</b> was not physically present, no contact ahead of time<br/>
						<b>Attended:</b> was physically present / learned course material<br/>
					</p>

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

						<Form.Button
							loading={loading}
							error={error.non_field_errors}
							disabled={!input.member_id}
						>
							Submit
						</Form.Button>
					</Form>
				</div>
			:
				<Button onClick={() => {setOpen(true); attendanceOpenCache = true;}}>
					Edit Attendance
				</Button>
			}
		</div>
	);
};

function InstructorClassEditor(props) {
	const { input, setInput, error, editing, token } = props;
	const [editInstructor, setEditInstructor] = useState(false);

	const handleValues = (e, v) => setInput({ ...input, [v.name]: v.value });
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
			{editing &&
				(editInstructor ?
					<>
						<Form.Field error={error.instructor_id}>
							<label>Instructor (search)</label>
							<MembersDropdown
								token={token}
								{...makeProps('instructor_id')}
								onChange={handleValues}
								initial={input.instructor_name}
							/>
							{error.instructor_id && <Label pointing prompt>
								{error.instructor_id}
							</Label>}
						</Form.Field>

						<Message info>
							<Message.Header>Are you sure?</Message.Header>
							<p>Only the new instructor will be able to edit this class.</p>
						</Message>
					</>
				:
					<Button
						onClick={() => setEditInstructor(true)}
					>
						Change instructor
					</Button>
				)
			}

			<p/>

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
					value={ input.datetime ?
						moment.utc(input.datetime).tz('America/Edmonton')
					:
						moment().tz('America/Edmonton').set({ minute: 0 })
					}
					onChange={handleDatetime}
					input={false}
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

					<InstructorClassEditor editing input={input} setInput={setInput} error={error} token={token} />

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
	const [input, setInput] = useState({ max_students: null });
	const [error, setError] = useState(false);
	const [progress, setProgress] = useState([]);
	const [loading, setLoading] = useState(false);
	const [success, setSuccess] = useState(false);
	const [classes, setClasses] = useState([]);
	const [sameClasses, setSameClasses] = useState(false);

	const handleSubmit = (e) => {
		if (loading) return;
		setLoading(true);
		setSuccess(false);

		const request_id = randomString();
		const getStatus = () => {
			requester('/stats/progress/?request_id='+request_id, 'GET')
			.then(res => {
				setProgress(res);
			})
			.catch(err => {
				console.log(err);
			});
		};
		const interval = setInterval(getStatus, 500);

		const data = { ...input, course: course.id, request_id: request_id };
		requester('/sessions/', 'POST', token, data)
		.then(res => {
			clearInterval(interval);
			setSuccess(res.id);
			setInput({ max_students: null });
			setLoading(false);
			setError(false);
			setOpen(false);
			setCourse({ ...course, sessions: [ res, ...course.sessions ] });
		})
		.catch(err => {
			clearInterval(interval);
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

	const fillSuggestion = (e) => {
		e.preventDefault();
		setInput({ ...input, ...course.suggestion });
	};

	return (
		<div>
			<Header size='medium'>Instructor Panel</Header>

			{!open && success && <p>Added! <Link to={'/classes/'+success}>View the class.</Link></p>}

			{open ?
				<Grid stackable padded columns={2}>
					<Grid.Column>
						<Form onSubmit={handleSubmit}>
							<Header size='small'>Add a Class</Header>

							<p>Documentation: <a href='https://wiki.protospace.ca/Be_a_Course_Instructor' target='_blank' rel='noopener noreferrer'>https://wiki.protospace.ca/Be_a_Course_Instructor</a></p>

							{course.suggestion &&
								<p><Button onClick={fillSuggestion}>Suggest</Button> based off previous classes.</p>
							}

							<InstructorClassEditor input={input} setInput={setInput} error={error} token={token} />

							<p>
								{progress.map(x => <>{x}<br /></>)}
							</p>

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
											{moment.utc(x.datetime).tz('America/Edmonton').format('LT')} — {x.course_data.name}
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
