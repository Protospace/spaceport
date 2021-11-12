import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Switch, Route, Link, useParams, useHistory } from 'react-router-dom';
import * as loadImage from 'blueimp-load-image';
import ReactCrop from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import './light.css';
import { Button, Container, Checkbox, Divider, Dropdown, Form, Grid, Header, Icon, Image, Menu, Message, Segment, Table } from 'semantic-ui-react';
import { BasicTable, staticUrl, requester, randomString } from './utils.js';
import { LoginForm, SignupForm } from './LoginSignup.js';

function LogoutEverywhere(props) {
	const { token } = props;
	const [error, setError] = useState(false);
	const [loading, setLoading] = useState(false);
	const [yousure, setYousure] = useState(false);
	const history = useHistory();

	const handleClick = () => {
		if (yousure) {
			if (loading) return;
			setLoading(true);
			requester('/rest-auth/logout/', 'POST', token, {})
			.then(res => {
				setYousure(false);
				history.push('/');
				window.scrollTo(0, 0);
			})
			.catch(err => {
				setLoading(false);
				console.log(err);
				setError(err.data);
			});
		} else {
			setYousure(true);
		}
	};

	return (
		<div>
			<Header size='medium'>Log Out from Everywhere</Header>

			<p>Use this to log out from all sessions on all computers.</p>

			{error && <p>Error, something went wrong.</p>}

			<Button onClick={handleClick} loading={loading}>
				{yousure ? 'You Sure?' : 'Log Out Everywhere'}
			</Button>
		</div>
	);
};

function ChangePasswordForm(props) {
	const { token } = props;
	const [input, setInput] = useState({});
	const [error, setError] = useState({});
	const [progress, setProgress] = useState([]);
	const [loading, setLoading] = useState(false);
	const history = useHistory();

	const handleValues = (e, v) => setInput({ ...input, [v.name]: v.value });
	const handleUpload = (e, v) => setInput({ ...input, [v.name]: e.target.files[0] });
	const handleChange = (e) => handleValues(e, e.currentTarget);

	const handleSubmit = (e) => {
		if (loading) return;
		setLoading(true);

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

		const data = { ...input, request_id: request_id };
		requester('/password/change/', 'POST', token, data)
		.then(res => {
			clearInterval(interval);
			setError({});
			history.push('/');
		})
		.catch(err => {
			clearInterval(interval);
			setLoading(false);
			console.log(err);
			setError(err.data);
		});
	};

	const makeProps = (name) => ({
		name: name,
		onChange: handleChange,
		value: input[name] || '',
		error: error[name],
	});

	return (
		<Form onSubmit={handleSubmit}>
			<Header size='medium'>Change Password</Header>

			<Form.Input
				label='Old Password'
				type='password'
				required
				{...makeProps('old_password')}
			/>
			<Form.Input
				label='New Password'
				type='password'
				required
				{...makeProps('new_password1')}
			/>
			<Form.Input
				label='Confirm Password'
				type='password'
				required
				{...makeProps('new_password2')}
			/>

			<p>
				{progress.map(x => <>{x}<br /></>)}
			</p>

			<Form.Button loading={loading} error={error.non_field_errors}>
				Submit
			</Form.Button>
		</Form>
	);
};


export function ImageCrop(props) {
	const { file, crop, setCrop } = props;
	const [src, setSrc] = useState(false);

	useEffect(() => {
		setSrc(false);
		setCrop({ unit: '%', height: 100, aspect: 3/4 });
		loadImage(
			file,
			img => {
				setSrc(img.toDataURL());
			},
			{
				meta: true,
				orientation: true,
				canvas: true,
				maxWidth: 300,
				maxHeight: 300,
			}
		);
	}, [file]);

	return (
		src ?
			<ReactCrop
				src={src}
				crop={crop}
				locked
				onChange={(crop, percentCrop) => setCrop(percentCrop)}
			/>
		:
			<p>Loading...</p>
	);
}

export function AccountForm(props) {
	const { token, user, refreshUser } = props;
	const member = user.member;
	const [input, setInput] = useState({ ...member, set_details: true });
	const [error, setError] = useState({});
	const [loading, setLoading] = useState(false);
	const [crop, setCrop] = useState(false);
	const history = useHistory();

	const handleValues = (e, v) => setInput({ ...input, [v.name]: v.value });
	const handleUpload = (e, v) => setInput({ ...input, [v.name]: e.target.files[0] });
	const handleChange = (e) => handleValues(e, e.currentTarget);
	const handleCheck = (e, v) => setInput({ ...input, [v.name]: v.checked });

	const handleSubmit = (e) => {
		if (loading) return;
		setLoading(true);
		const data = { ...input, email: input.email.toLowerCase(), crop: JSON.stringify(crop) };
		requester('/members/' + member.id + '/', 'PATCH', token, data)
		.then(res => {
			setError({});
			refreshUser();
			history.push('/');
		})
		.catch(err => {
			setLoading(false);
			console.log(err);
			setError(err.data);
		});
	};

	const makeProps = (name) => ({
		name: name,
		onChange: handleChange,
		value: input[name] || '',
		error: error[name],
		...(input[name] ? {} : {icon: 'edit'}),
	});

	return (
		<Form onSubmit={handleSubmit}>
			<Header size='medium'>Member Details</Header>

			<Form.Input
				label='Preferred First Name'
				required
				{...makeProps('preferred_name')}
			/>

			<Form.Input
				label='Email Address'
				required
				{...makeProps('email')}
			/>

			<Form.Input
				label='Phone Number (999) 555-1234'
				required
				{...makeProps('phone')}
			/>

			<Form.Field>
				<label>Are you under 18 years old?</label>
				<Checkbox
					label='I am a minor'
					name='is_minor'
					onChange={handleCheck}
					checked={input.is_minor}
				/>
			</Form.Field>

			{input.is_minor && <Form.Input
				label='Birthdate YYYY-MM-DD'
				{...makeProps('birthdate')}
			/>}
			{input.is_minor && <Form.Input
				label="Guardian's Name"
				{...makeProps('guardian_name')}
			/>}

			<Form.Input
				label='Emergency Contact Name'
				{...makeProps('emergency_contact_name')}
			/>
			<Form.Input
				label='Emergency Contact Phone'
				{...makeProps('emergency_contact_phone')}
			/>

			{member.discourse_username && <Form.Input
				label='Discourse Username'
				{...makeProps('discourse_username')}
			/>}

			<Form.Field>
				<label>Participate in "Last Scanned" member list?</label>
				<Checkbox
					label='Yes, show me'
					name='allow_last_scanned'
					onChange={handleCheck}
					checked={input.allow_last_scanned}
				/>
			</Form.Field>

			<Form.Input
				label='Member Photo'
				name='photo'
				type='file'
				accept='image/*'
				onChange={handleUpload}
			/>

			{input.photo &&
				<>
					<ImageCrop file={input.photo} crop={crop} setCrop={setCrop} />
					{crop && crop.width === crop.height ?
						<p>It's the perfect size!</p>
					:
						<p>Move the box above to crop your image.</p>
					}
				</>
			}

			<Form.Button loading={loading} error={error.non_field_errors}>
				Submit
			</Form.Button>
		</Form>
	);
};

export function BioNotesForm(props) {
	const { token, user, refreshUser } = props;
	const member = user.member;
	const [input, setInput] = useState({ ...member, set_details: true });
	const [error, setError] = useState({});
	const [loading, setLoading] = useState(false);
	const history = useHistory();

	const handleValues = (e, v) => setInput({ ...input, [v.name]: v.value });
	const handleUpload = (e, v) => setInput({ ...input, [v.name]: e.target.files[0] });
	const handleChange = (e) => handleValues(e, e.currentTarget);
	const handleCheck = (e, v) => setInput({ ...input, [v.name]: v.checked });

	const handleSubmit = (e) => {
		if (loading) return;
		setLoading(true);
		requester('/members/' + member.id + '/', 'PATCH', token, input)
		.then(res => {
			setError({});
			refreshUser();
			history.push('/');
		})
		.catch(err => {
			setLoading(false);
			console.log(err);
			setError(err.data);
		});
	};

	const makeProps = (name) => ({
		name: name,
		onChange: handleChange,
		value: input[name] || '',
		error: error[name],
	});

	return (
		<Form onSubmit={handleSubmit}>
			<Header size='medium'>Bio / Notes</Header>

			<Form.TextArea
				label={'Public Bio' + (input.public_bio && input.public_bio.length > 400 ? ' — ' + input.public_bio.length + ' / 512' : '')}
				{...makeProps('public_bio')}
			/>

			<p>Bio shared with members. Example: contact info, allergies, hobbies, etc.</p>

			<Form.TextArea
				label={'Private Notes' + (input.private_notes && input.private_notes.length > 400 ? ' — ' + input.private_notes.length + ' / 512' : '')}
				{...makeProps('private_notes')}
			/>

			<p>Notes visible only to directors and admins.</p>

			<Form.Button loading={loading} error={error.non_field_errors}>
				Submit
			</Form.Button>
		</Form>
	);
};

export function Account(props) {
	return (
		<Container>
			<Header size='large'>Account Settings</Header>
			<Grid stackable columns={2}>
				<Grid.Column>
					<Segment padded><AccountForm {...props} /></Segment>
				</Grid.Column>
				<Grid.Column>
					<Segment padded><BioNotesForm {...props} /></Segment>
					<Segment padded><ChangePasswordForm {...props} /></Segment>
					<Segment padded><LogoutEverywhere {...props} /></Segment>
				</Grid.Column>
			</Grid>
		</Container>
	);
};
