import React, { useState, useEffect, useReducer, useRef } from 'react';
import { Link, useParams } from 'react-router-dom';
import './light.css';
import { Label, Button, Container, Dimmer, Dropdown, Form, FormField, Header, Icon, Loader, Input, Segment, Table, TextArea } from 'semantic-ui-react';
import { apiUrl, isAdmin, getInstructor, getInstructorDiscourseLink, BasicTable, requester, useIsMobile } from './utils.js';

export function AddNewTool(props) {
	const { token } = props;

	const loanStatusOptions = [
		{ key: 'owned', text: 'Owned by Protospace', value: 'Owned by Protospace' },
		{ key: 'donated', text: 'Donated to Protospace', value: 'Donated to Protospace' },
		{ key: 'longtermloan', text: 'Long term loan', value: 'Long term loan' },
		{ key: 'other', text: 'Other', value: 'Other' },
	];

	const functionalStatusOptions = [
		{ key: 'functional', text: 'Yes', value: 'Functional' },
		{ key: 'nonfunctional', text: 'No', value: 'Non functional' },
		{ key: 'unknown', text: 'Unknown', value: 'Unknown' },
	]

	const [loading, setLoading] = useState(false);
	const [formData, setFormData] = useState({
		'owner': 'Protospace',
		'loanstatus': loanStatusOptions[0].value,
		'functionalstatus': functionalStatusOptions[0].value,
		'permission': 'Members',
		'certification': 'Read the manual',
		'photo': null
	});
	const [error, setError] = useState(false);
	const [toolUrl, setToolUrl] = useState('');
	const [photoKey, setPhotoKey] = useState(Date.now());
	const [photoProblem, setPhotoProblem] = useState(false)

	const handleChange = (e, v) => setFormData({ ...formData, [v.name]: v.value });

	const handleFileChange = (e) => {
		let file = e.target.files[0];
		setFormData({ ...formData, photo: file });

		// the wiki only allows certain image formats: https://wiki.protospace.ca/Special:Upload
		const allowedExtensions = [
			'image/png',
			'image/gif',
			'image/jpg',
			'image/jpeg',
			'image/webp'
		];

		if (!allowedExtensions.includes(file.type)) {
			setPhotoProblem('Photo is not in an allowed format. It must be one of: ' + allowedExtensions.join(', ').replace(/image\//g, ''));
		}

		// the wiki only allows files under 8 mb
		const allowedSize = 8;
		if (file.size >= allowedSize * 1024 * 1024) {
			setPhotoProblem(`Photo is too big. It must be smaller than ${allowedSize} MB`);
		}
	};

	const handleDeletePhoto = () => {
		const updatedFormData = { ...formData };
		delete updatedFormData['photo'];
		setFormData(updatedFormData);
		setPhotoProblem(false);
		// force rerender
		setPhotoKey(Date.now());
	};

	const postTool = () => {
		if (loading) return;
		setLoading(true);
		requester('/tools/', 'POST', token, formData)
		.then(res => {
			setLoading(false);
			setError(false);
			setToolUrl(res.toolUrl);
		})
		.catch(err => {
			setLoading(false);
			setError(true);
			setToolUrl('');
		});
	};

	return (
		<Container>
			{error && <>
				<Header size='large'>Something went wrong!</Header>

				<p>Please try again one more time. If it fails again, do not try again. There's probably something we need to fix.</p>
			</>}

			{toolUrl != '' && !error && <>
				<Header size='large'>Successfully created tool wiki page</Header>

				<p>Go to it here: <a href={toolUrl} target='_blank'>{toolUrl}</a></p>

				<Button onClick={() => window.location.reload(false)}>Make another tool page</Button>
			</>}

			{toolUrl == '' && !error && <>
				<Header size='large'>Add a New Tool Page to the Wiki</Header>

				<p>Fill out the following form for your tool:</p>

				<Form>
					{loading &&
						<Dimmer active>
							<Loader />
						</Dimmer>
					}

					<Form.Field required>
						<label>What is this tool called in simple terms? (e.g. Laser cutter, table saw, hand planer, etc)</label>
						<Input
							placeholder='Tool Name'
							name='toolname'
							required
							onChange={handleChange}
						/>
					</Form.Field>

					<Form.Field>
						<label>Please write the Make and Model of the tool. Be careful of typos!</label>
						<Input
							placeholder='Make - Model'
							name='model'
							onChange={handleChange}
						/>
					</Form.Field>

					<Form.Field>
						<label>Serial Number (leave blank if none)</label>
						<Input
							placeholder='Serial Number'
							name='serial'
							onChange={handleChange}
						/>
					</Form.Field>

					<Form.Field required>
						<label>Who is the original owner of this tool?</label>
						<Input
							placeholder='Owner'
							name='owner'
							value='Protospace'
							required
							onChange={handleChange}
							value={formData.owner}
						/>
					</Form.Field>

					{formData.owner != 'Protospace' && <Form.Field required>
						<label>What is the loan status for this tool?</label>
						<Dropdown
							placeholder='Select Loan Status'
							fluid
							selection
							options={loanStatusOptions}
							required
							name='loanstatus'
							onChange={handleChange}
							value={formData.loanstatus}
						/>
					</Form.Field>}

					<Form.Field required>
						<label>When did this tool arrive at the space?</label>
						<Input
							type='date'
							name='arrived'
							required
							onChange={handleChange}
						/>
					</Form.Field>

					<Form.Field>
						<label>Where is this tool in the space?</label>
						<Input
							placeholder='Location'
							name='location'
							onChange={handleChange}
						/>
					</Form.Field>

					<Form.Field required>
						<label>Is the tool functioning as expected?</label>
						<Dropdown
							name='functionalStatus'
							options={functionalStatusOptions}
							required
							onChange={handleChange}
							value={formData.functionalstatus}
						/>
					</Form.Field>

					<Form.Field required>
						<label>Who is permitted to use this tool?</label>
						<Input
							placeholder='Permission Level'
							name='permission'
							required
							onChange={handleChange}
							value={formData.permission}
						/>
					</Form.Field>

					<Form.Field required>
						<label>Is there any training required to use this tool?</label>
						<Input
							placeholder='Certification Details'
							name='certification'
							onChange={handleChange}
							value={formData.certification}
						/>
					</Form.Field>

					<Form.Field required>
						<label>Photo</label>
						<Input
							type='file'
							name='photo'
							key={photoKey}
							onChange={handleFileChange}
							required
						/>
						<div>
							{formData.photo &&
								<Button
									onClick={handleDeletePhoto}
									style={{ display: 'inline-block', marginRight: '10px' }}
								>
									<i className='trash icon'></i>&nbsp;Remove Photo
								</Button>
							}

							{photoProblem && <p style={{ display: 'inline-block', margin: 0, color: 'red' }}>{photoProblem}</p>}
						</div>
					</Form.Field>

					{formData.photo && <Form.Field>
						<label>Caption</label>
						<TextArea
							placeholder='Add a caption for the photo'
							name='caption'
							onChange={handleChange}
						/>
					</Form.Field>}

					<Form.Field>
						<label>Relevant Links</label>
						<p>Please copy and paste links that provide more detail about the tool. Examples:</p>
						<ul>
							<li>Forum posts</li>
							<li>Google group posts</li>
							<li>Manufacturer information pages</li>
						</ul>
						<p>Please only have one link per line</p>
						<TextArea
							placeholder='Add hyperlinks for pages that provide more detail about this tool'
							name='links'
							onChange={handleChange}
						/>
					</Form.Field>

					<Button
						// TODO: implement validation as per LoginSignup
						type='submit'
						onClick={postTool}
						primary
						loading={loading}
						disabled={photoProblem}
					>
						Submit
					</Button>
				</Form>

			</>}
		</Container>
	);
};
