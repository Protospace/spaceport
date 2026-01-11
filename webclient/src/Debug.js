import React, { useState, useEffect } from 'react';
import { Link, useParams, useHistory } from 'react-router-dom';
import './light.css';
import { MembersDropdown } from './Members.js';
import { isAdmin, BasicTable, requester } from './utils.js';
import { Button, Container, Form, Grid, Header, Message, Segment, Table } from 'semantic-ui-react';

export function Debug(props) {
	const { token } = props;

	return (
		<Container>
			<Header size='large'>Debug</Header>

			<p>No warranty.</p>

			<p>
				<Button onClick={() => {throw new Error('test')}}>
					Cause an error
				</Button>
			</p>

			<p>
				<Button onClick={() => {localStorage.clear()}}>
					Clear localStorage
				</Button>
			</p>

			<p><Link to='/classfeed'>Classfeed</Link></p>

			<p><Link to='/display/lcars1'>LCARS1 Display</Link></p>

			<p><Link to='/display/lcars2'>LCARS2 Display</Link></p>

			<p><Link to='/display/lcars3'>LCARS3 Display</Link></p>

			<p><Link to='/add-new-tool'>Add new Tool</Link></p>

		</Container>
	);
};
