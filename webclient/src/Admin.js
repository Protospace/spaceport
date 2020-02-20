import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Switch, Route, Link, useParams, useHistory } from 'react-router-dom';
import './light.css';
import { Button, Container, Checkbox, Dimmer, Divider, Dropdown, Form, Grid, Header, Icon, Image, Menu, Message, Segment, Table } from 'semantic-ui-react';
import moment from 'moment';
import { apiUrl, statusColor, BasicTable, staticUrl, requester } from './utils.js';
import { NotFound } from './Misc.js';

export function Admin(props) {
	return (
		<Container>
			<Header size='large'>Portal Admin</Header>

			<Header size='medium'>Member Data Backup</Header>
			<p>Spaceport backups are created daily. 14 days are kept on the server.</p>
			<p>Backups contain the complete member data and must be kept secure.</p>
			<p>Talk to Tanner to learn how to get backups.</p>

		</Container>
	);
};
