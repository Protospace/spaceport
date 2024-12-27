import React, { useState, useEffect, useReducer, useRef } from 'react';
import { Link, useParams } from 'react-router-dom';
import './light.css';
import { Label, Button, Container, Dimmer, Dropdown, Form, FormField, Header, Icon, Loader, Input, Segment, Table, TextArea } from 'semantic-ui-react';
import moment from 'moment-timezone';
import { apiUrl, isAdmin, getInstructor, getInstructorDiscourseLink, BasicTable, requester, useIsMobile } from './utils.js';
import { NotFound } from './Misc.js';
import { InstructorClassDetail, InstructorClassAttendance } from './InstructorClasses.js';
import { PayPalPayNow } from './PayPal.js';
import { PayWithProtocoin } from './Paymaster.js';
import { tags } from './Courses.js';

export function AddNewTool(props) {
	const { token, user, refreshUser } = props;

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
		"owner": "Protospace",
		"loanstatus": loanStatusOptions[0].value,
		"functionalstatus": functionalStatusOptions[0].value,
		"permission": "Members",
		"certification": "Read the manual",
		"photo": null
	});
	const [error, setError] = useState(false);
	const [toolUrl, setToolUrl] = useState('');
	const [photoKey, setPhotoKey] = useState(Date.now());
	const handleChange = (e, v) => setFormData({ ...formData, [v.name]: v.value });
  	const handleFileChange = (e) => { setFormData({ ...formData, photo: e.target.files[0] }); };
	const handleDeletePhoto = () => {
		const updatedFormData = { ...formData };
		delete updatedFormData['photo'];
		setFormData(updatedFormData);
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
		});
	};

	return (
		<>
		{ error && (<Container>
				<Header size='large'>Mistake</Header>

				<p>Something messed up</p>
			</Container>)}
		{ toolUrl != "" && !error && (<Container>
				<Header size='large'>Successfully created tool wiki page</Header>

				<p>Go to it here: <a href={toolUrl}>{toolUrl}</a></p>

				<Button onClick={() => window.location.reload(false)}>Make another tool page</Button>
			</Container>)}

		{ toolUrl == "" && !error && (<Container>
			<Header size='large'>Add a New Tool Page to the Wiki</Header>

			<p>Fill out the following form for your tool</p>
		    <Form>
			{loading && 
				<Dimmer active>
					<Loader />
				</Dimmer>
			}
		      <Form.Field required>
		        <label>What is this tool called in simple terms? (e.g. Laser cutter, table saw, hand planer, etc)</label>
			<Input
				placeholder="Tool Name"
				name="toolname"
				required
				onChange={handleChange}
			/>
		      </Form.Field>
		
		      <Form.Field>
		        <label>Make/Model</label>
		        <Input 
				placeholder="Make/Model"
				name="model"
				onChange={handleChange}
			/>
		      </Form.Field>
		
		      <Form.Field>
		        <label>Serial Number (leave blank if none)</label>
		        <Input
				placeholder="Serial Number" 
				name="serial" 
				onChange={handleChange}
			/>
		      </Form.Field>
		
		      <Form.Field required>
		        <label>Who is the original owner of this tool?</label>
		        <Input 
				placeholder="Owner" 
				name="owner" 
				value="Protospace"
				required
				onChange={handleChange}
				value={formData.owner}
			/>
		      </Form.Field>

		{formData.owner != "Protospace" && 
			(
				<Form.Field required>
					<label>What is the loan status for this tool?</label>
					<Dropdown 
						placeholder="Select Loan Status" 
						fluid 
						selection 
						options={loanStatusOptions} 
						required
						name="loanstatus"
						onChange={handleChange}
						value={formData.loanstatus}
					/>
				</Form.Field>
			)}	
		
		      <Form.Field required>
		        <label>When did this tool arrive at the space?</label>
		        <Input 
				type="date" 
				name="arrived" 
				required 
				onChange={handleChange}
			/>
		      </Form.Field>
		
		      <Form.Field>
		        <label>Where is this tool in the space?</label>
		        <Input 
				placeholder="Location" 
				name="location" 
				onChange={handleChange}
			/>
		      </Form.Field>
		
		      <Form.Field required>
		        <label>Is the tool functioning as expected?</label>
		        <Dropdown 
				name="functionalStatus"
				options={functionalStatusOptions}
				required
				onChange={handleChange}
				value={formData.functionalstatus}
			/>
		      </Form.Field>
		
		      <Form.Field required>
		        <label>Who is permitted to use this tool?</label>
		        <Input 
				placeholder="Permission Level" 
				name="permission" 
				required
				onChange={handleChange}
				value={formData.permission}
			/>
		      </Form.Field>
		
		      <Form.Field required>
		        <label>Is there any training required to use this tool?</label>
		        <Input 
				placeholder="Certification Details" 
				name="certification"
				onChange={handleChange}
				value={formData.certification}
			/>
		      </Form.Field>
		
		      <Form.Field>
		        <label>Photo</label>
		        <Input 
				type="file"
				name="photo" 
				key={photoKey}
				onChange={handleFileChange}
			/>
			{formData.photo && (
				<Button onClick={handleDeletePhoto}>
					<i className="trash icon"></i>	
					Remove Photo 
				</Button>
			)}
		      </Form.Field>
		
		{ formData.photo && (
			<Form.Field>
			<label>Caption</label>
			<TextArea
			placeholder="Add a caption for the photo"
			name="caption"
			onChange={handleChange}
			/>
			</Form.Field>
		)}
		
		      <Button 
				type="submit" 
				onClick={postTool} 
				primary
				loading={loading}
			>
		        Submit
		      </Button>
		    </Form>

		</Container>)}
		</>
	);
};
