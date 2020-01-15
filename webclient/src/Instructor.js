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
				<label>Description</label>
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

function InstructorCourseDetail(props) {
	const [input, setInput] = useState({ ...props.card });
	const [error, setError] = useState(false);
	const [loading, setLoading] = useState(false);
	const [success, setSuccess] = useState(false);
	const id = props.card.id;

	const handleValues = (e, v) => setInput({ ...input, [v.name]: v.value });
	const handleUpload = (e, v) => setInput({ ...input, [v.name]: e.target.files[0] });
	const handleChange = (e) => handleValues(e, e.currentTarget);
	const handleCheck = (e, v) => setInput({ ...input, [v.name]: v.checked });

	const handleSubmit = (e) => {
		setLoading(true);
		setSuccess(false);
		const data = { ...input, member_id: props.result.member.id };
		requester('/cards/'+id+'/', 'PUT', props.token, data)
		.then(res => {
			setLoading(false);
			setSuccess(true);
			setError(false);
			setInput(res);
		})
		.catch(err => {
			setLoading(false);
			console.log(err);
			setError(err.data);
		});
	};

	const handleDelete = (e) => {
		e.preventDefault();

		requester('/cards/'+id+'/', 'DELETE', props.token)
		.then(res => {
			setInput(false);
		})
		.catch(err => {
			console.log(err);
		});
	};

	const statusOptions = [
		{ key: '0', text: 'Card Active', value: 'card_active' },
		{ key: '1', text: 'Card Blocked', value: 'card_blocked' },
		{ key: '2', text: 'Card Inactive', value: 'card_inactive' },
		{ key: '3', text: 'Card Member Blocked', value: 'card_member_blocked' },
	];

	return (
		input ?
			<Segment raised color={input.active_status === 'card_active' ? 'green' : 'red'}>
				<Form onSubmit={handleSubmit}>
					<Form.Group widths='equal'>
						<Form.Input
							fluid
							{...makeProps('card_number')}
						/>
						<Form.Select
							fluid
							options={statusOptions}
							{...makeProps('active_status')}
							onChange={handleValues}
						/>

						<Form.Group widths='equal'>
							<Form.Button
								loading={loading}
								error={error.non_field_errors}
							>
								{success ? 'Saved.' : 'Save'}
							</Form.Button>

							<Form.Button
								color='red'
								onClick={handleDelete}
							>
								Delete
							</Form.Button>
						</Form.Group>
					</Form.Group>

					Notes: {input.notes || 'None'}
				</Form>
			</Segment>
		:
			<Segment raised color='black'>
				Deleted card: {props.card.card_number}
			</Segment>
	);
};

export function InstructorCourseList(props) {
	const { courses, setCourses, token } = props;
	const [open, setOpen] = useState(false);
	const [input, setInput] = useState({});
	const [error, setError] = useState(false);
	const [loading, setLoading] = useState(false);
	const [success, setSuccess] = useState(false);

	const handleSubmit = (e) => {
		setLoading(true);
		setSuccess(false);
		const data = { ...input, is_old: false };
		requester('/courses/', 'POST', props.token, data)
		.then(res => {
			setSuccess(res.id);
			setInput({});
			setLoading(false);
			setError(false);
			setOpen(false);
			props.setCourses([ ...courses, res ]);
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

			{success && <p>Added to bottom of course list! <Link to={'/courses/'+success}>View the course.</Link></p>}

			{open ?
				<Form onSubmit={handleSubmit}>
					<Header size='small'>Add a Course</Header>

					<InstructorCourseEditor input={input} setInput={setInput} error={error} />

					<Form.Button loading={loading} error={error.non_field_errors}>
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

