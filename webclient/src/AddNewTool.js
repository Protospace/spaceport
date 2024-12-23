import React, { useState, useEffect, useReducer } from 'react';
import { Link, useParams } from 'react-router-dom';
import './light.css';
import { Label, Button, Container, Dropdown, Form, FormField, Header, Icon, Input, Segment, Table, TextArea } from 'semantic-ui-react';
import moment from 'moment-timezone';
import { apiUrl, isAdmin, getInstructor, getInstructorDiscourseLink, BasicTable, requester, useIsMobile } from './utils.js';
import { NotFound } from './Misc.js';
import { InstructorClassDetail, InstructorClassAttendance } from './InstructorClasses.js';
import { PayPalPayNow } from './PayPal.js';
import { PayWithProtocoin } from './Paymaster.js';
import { tags } from './Courses.js';

export function AddNewTool(props) {
	const { token, user, refreshUser } = props;
	const [loading, setLoading] = useState(false);
	const [formData, setFormData] = useState({});
	const [error, setError] = useState(false);

	const handleChange = (e, v) => setFormData({ ...formData, [v.name]: v.value });
  	const handleFileChange = (e) => { setFormData({ ...formData, photo: e.target.files[0] }); };

	const postTool = () => {
		console.log("Adding thing");
		if (loading) return;
		setLoading();
		requester('/tools/', 'POST', token, formData)
		.then(res => {
			console.log('success')
			// setError(false);
		})
		.catch(err => {
			console.log(err);
			setError(true);
		});
	};

	const loanStatusOptions = [
		{ key: 'owned', text: 'Owned by Protospace', value: 'owned' },
		{ key: 'long', text: 'Long Term', value: 'long' },
		{ key: 'na', text: 'Other', value: 'na' },
	];

	const toolStatusOptions = [
		{ key: 'functional', text: 'Functional', value: 'func' },
		{ key: 'nonfunctional', text: 'Non Functional', value: 'nonfunc' },
		{ key: 'unknown', text: 'Unknown', value: 'unk' },
	]

	return (
		<Container>
			<Header size='large'>Create a new tool</Header>

			<p>Fill out the following form for your tool</p>

		    <Form>
		      <Form.Field>
		        <label>Tool Name</label>
			<Input
				placeholder="Tool
				Name"
				name="toolname"
				required
				onChange={handleChange}
			/>
		      </Form.Field>
		
		      <Form.Field>
		        <label>Model</label>
			<Input
				placeholder="Make"
				name="make"
				onChange={handleChange}
			/>
		      </Form.Field>
		
		      <Form.Field>
		        <label>Model</label>
		        <Input 
				placeholder="Model"
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
		
		      <Form.Field>
		        <label>Owner</label>
		        <Input 
				placeholder="Owner" 
				name="owner" 
				value="Protospace"
				required
				onChange={handleChange}
			/>
		      </Form.Field>
		
		      <Form.Field>
		        <label>Loan Status</label>
		        <Dropdown 
				placeholder="Select Loan Status" 
				fluid 
				selection 
				options={loanStatusOptions} 
				required
				name="loanstatus" 
				onChange={handleChange}
		        />
		      </Form.Field>
		
		      <Form.Field>
		        <label>Date Arrived</label>
		        <Input 
				type="date" 
				name="arrived" 
				required 
				onChange={handleChange}
			/>
		      </Form.Field>
		
		      <Form.Field>
		        <label>Location</label>
		        <Input 
				placeholder="Location" 
				name="location" 
				onChange={handleChange}
			/>
		      </Form.Field>
		
		      <Form.Field>
		        <label>Status</label>
		        <Dropdown 
				placeholder="Enter Status" 
				name="status" 
				options={toolStatusOptions} 
				required
				onChange={handleChange}
			/>
		      </Form.Field>
		
		      <Form.Field>
		        <label>Permission Level</label>
		        <Input 
				placeholder="Permission Level" 
				name="permission" 
				required
				onChange={handleChange}
			/>
		      </Form.Field>
		
		      <Form.Field>
		        <label>Certification</label>
		        <Input 
				placeholder="Certification Details" 
				name="certification"
				onChange={handleChange}
			/>
		      </Form.Field>
		
		      <Form.Field>
		        <label>Photo</label>
		        <Input 
				type="file"
				name="photo" 
				onChange={handleFileChange}
			/>
		      </Form.Field>
		
		      <Form.Field>
		        <label>Caption</label>
		        <TextArea
				placeholder="Add a caption for the photo"
				name="caption"
				onChange={handleChange}
			/>
		      </Form.Field>
		
		      <Button type="submit" onClick={postTool} primary>
		        Submit
		      </Button>
		    </Form>

		</Container>
	);
};
