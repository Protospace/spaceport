import React, { useState, useEffect, useReducer } from 'react';
import { BrowserRouter as Router, Switch, Route, Link, useParams, useLocation } from 'react-router-dom';
import moment from 'moment-timezone';
import QRCode from 'react-qr-code';
import './light.css';
import { Button, Container, Divider, Dropdown, Form, Grid, Header, Icon, Image, Menu, Message, Popup, Segment, Table } from 'semantic-ui-react';
import { statusColor, BasicTable, siteUrl, staticUrl, requester, isAdmin } from './utils.js';
import { LoginForm, SignupForm } from './LoginSignup.js';
import { AccountForm } from './Account.js';
import { SignForm } from './Sign.js';
import { PayPalSubscribeDeal } from './PayPal.js';

export function Debug(props) {
	const { user, token } = props;

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


		</Container>
	);
};
