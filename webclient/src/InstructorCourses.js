import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Switch, Route, Link, useParams, useHistory } from 'react-router-dom';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import './light.css';
import { Button, Container, Checkbox, Divider, Dropdown, Form, Grid, Header, Icon, Image, Label, Menu, Message, Segment, Table } from 'semantic-ui-react';
import { BasicTable, staticUrl, requester } from './utils.js';

function InstructorCourseEditor(props) {
	const { input, setInput, error } = props;

	const handleValues = (e, v) => setInput({ ...input, [v.name]: v.value });
	const handleUpload = (e, v) => setInput({ ...input, [v.name]: e.target.files[0] });
	const handleChange = (e) => handleValues(e, e.currentTarget);
	const handleCheck = (e, v) => setInput({ ...input, [v.name]: v.checked });
	const handleQuill = (v, d, s, e) => s === 'user' && setInput({
		...input,
		description: v === '<p><br></p>' ? '' : v,
	});

	const makeProps = (name) => ({
		name: name,
		onChange: handleChange,
		value: input[name] || '',
		error: error[name],
	});

	const modules = {
		toolbar: [
			[{ 'header': [3, false] }],
			['bold', 'italic', 'underline', 'code'],
			[{'list': 'ordered'}, {'list': 'bullet'}],
			['link'],
			['clean']
		],
	};

	return (
		<div className='course-editor'>
			<Form.Input
				label='Course Name'
				fluid
				{...makeProps('name')}
			/>

			<Form.Field>
				<label>
					Description
					{input.description && input.description.length > 3000 && (
						' — ' + (input.description.length+' / 6000')
					)}
				</label>
				<ReactQuill
					value={input.description || ''}
					modules={modules}
					onChange={handleQuill}
				/>

				{error.description &&
					<Label pointing prompt>
						{error.description}
					</Label>
				}
			</Form.Field>
		</div>
	);
}

export function InstructorCourseDetail(props) {
	const { course, setCourse, token } = props;
	const [open, setOpen] = useState(false);
	const convertNewlineToPara = (t) => t.split('\n').map(x => '<p>'+x+'</p>').join('')
	const [input, setInput] = useState({
		...course,
		description: course.is_old ? convertNewlineToPara(course.description) : course.description,
	});
	const [error, setError] = useState(false);
	const [loading, setLoading] = useState(false);
	const [success, setSuccess] = useState(false);
	const { id } = useParams();

	const handleSubmit = (e) => {
		if (loading) return;
		setLoading(true);
		setSuccess(false);
		const data = { ...input, is_old: false };
		requester('/courses/'+id+'/', 'PUT', token, data)
		.then(res => {
			setSuccess(true);
			setLoading(false);
			setError(false);
			setOpen(false);
			setCourse({...course, ...res});
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
					<Header size='small'>Edit Course</Header>

					<InstructorCourseEditor input={input} setInput={setInput} error={error} />

					<Form.Button loading={loading} error={error.non_field_errors}>
						Submit
					</Form.Button>
				</Form>
			:
				<Button onClick={() => setOpen(true)}>
					Edit Course
				</Button>
			}
		</div>
	);
};

export function InstructorCourseList(props) {
	const { courses, setCourses, token } = props;
	const [open, setOpen] = useState(false);
	const [input, setInput] = useState({});
	const [error, setError] = useState(false);
	const [loading, setLoading] = useState(false);
	const [success, setSuccess] = useState(false);

	const handleValues = (e, v) => setInput({ ...input, [v.name]: v.value });
	const handleUpload = (e, v) => setInput({ ...input, [v.name]: e.target.files[0] });
	const handleChange = (e) => handleValues(e, e.currentTarget);
	const handleCheck = (e, v) => setInput({ ...input, [v.name]: v.checked });
	const handleQuill = (v, d, s, e) => s === 'user' && setInput({
		...input,
		description: v === '<p><br></p>' ? '' : v,
	});

	const makeProps = (name) => ({
		name: name,
		onChange: handleChange,
		value: input[name] || '',
		error: error[name],
	});

	const handleSubmit = (e) => {
		if (loading) return;
		setLoading(true);
		setSuccess(false);
		const data = { ...input, is_old: false };
		requester('/courses/', 'POST', token, data)
		.then(res => {
			setSuccess(res.id);
			setInput({});
			setLoading(false);
			setError(false);
			setOpen(false);
			setCourses([ ...courses, res ]);
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

			{!open && success && <p>Added to bottom of course list! <Link to={'/courses/'+success}>View the course.</Link></p>}

			{open ?
				<Form onSubmit={handleSubmit}>
					<Header size='small'>Add a Course</Header>

					<InstructorCourseEditor input={input} setInput={setInput} error={error} />

					<Form.Checkbox
						label='I understand the difference between a course and a class. There are no other courses for this topic.'
						required
						{...makeProps('understand_courses')}
						onChange={handleCheck}
						checked={input.understand_courses}
					/>

					<Form.Button disabled={!input.understand_courses} loading={loading} error={error.non_field_errors}>
						Submit
					</Form.Button>
				</Form>
			:
				<Button onClick={() => setOpen(true)}>
					Add a Course
				</Button>
			}
		</div>
	);
};
