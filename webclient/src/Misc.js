import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Switch, Route, Link, useParams } from 'react-router-dom';
import './light.css';
import { Container, Divider, Dropdown, Form, Grid, Header, Icon, Image, Menu, Message, Segment, Table } from 'semantic-ui-react';

export function PleaseLogin() {
	return (
		<Container text>
			<Message warning>
				<Message.Header style={{ padding: 0 }}>You must login before you can do that!</Message.Header>
				<p>Visit our <Link to='/'>login page</Link>, then try again.</p>
			</Message>
		</Container>
	);
};

export function NotFound() {
	return (
		<Container text>
			<Message warning>
				<Message.Header style={{ padding: 0 }}>The page you requested can't be found!</Message.Header>
				<p>Visit our <Link to='/'>home page</Link> if you are lost.</p>
			</Message>
		</Container>
	);
};

