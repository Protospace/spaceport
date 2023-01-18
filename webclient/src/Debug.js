import React from 'react';
import { Link } from 'react-router-dom';
import './light.css';
import { Button, Container, Header } from 'semantic-ui-react';

export function Debug(props) {
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

			<p><Link to='/usage/trotec'>Trotec Usage</Link></p>

			<p><Link to='/display/lcars1'>LCARS1 Display</Link></p>


		</Container>
	);
};
