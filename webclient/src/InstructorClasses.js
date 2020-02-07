import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Switch, Route, Link, useParams, useHistory } from 'react-router-dom';
import * as Datetime from 'react-datetime';
import 'react-datetime/css/react-datetime.css';
import moment from 'moment';
import './light.css';
import { Button, Container, Checkbox, Divider, Dropdown, Form, Grid, Header, Icon, Image, Label, Menu, Message, Segment, Table } from 'semantic-ui-react';
import { BasicTable, staticUrl, requester } from './utils.js';

function AttendanceRow(props) {
	const { student, token, refreshClass } = props;
	const [error, setError] = useState(false);

	const handleMark = (newStatus) => {
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
	});

	return (
		<div className='attendance-row'>
			<p>{student.student_name}:</p>

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
	const { clazz, token } = props;
	const [error, setError] = useState(false);

	return (
		<div>
			<Header size='medium'>Instructor Panel</Header>

			<Header size='small'>Mark Attendance</Header>

			{clazz.students.length ?
				clazz.students.map(x =>
					<AttendanceRow key={x.id} student={x} {...props} />
				)
			:
				<p>No students yet.</p>
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
					value={ input.datetime ? moment.utc(input.datetime).local() : (new Date()).setMinutes(0) }
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

	return (
		<div>
			<Header size='medium'>Instructor Panel</Header>

			{!open && success && <p>Added! <Link to={'/classes/'+success}>View the class.</Link></p>}

			{open ?
				<Form onSubmit={handleSubmit}>
					<Header size='small'>Add a Class</Header>

					<InstructorClassEditor input={input} setInput={setInput} error={error} />

					<Form.Button loading={loading} error={error.non_field_errors}>
						Submit
					</Form.Button>
				</Form>
			:
				<Button onClick={() => setOpen(true)}>
					Add a Class
				</Button>
			}
		</div>
	);
};
