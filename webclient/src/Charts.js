import React, { useState, useEffect, useReducer, useContext } from 'react';
import { BrowserRouter as Router, Switch, Route, Link, useParams, useHistory } from 'react-router-dom';
import { Button, Container, Checkbox, Dimmer, Divider, Dropdown, Form, Grid, Header, Icon, Image, Menu, Message, Segment, Table } from 'semantic-ui-react';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine } from 'recharts';
import { apiUrl, statusColor, BasicTable, staticUrl, requester } from './utils.js';
import { NotFound } from './Misc.js';

let memberCountCache = false;
let signupCountCache = false;

export function Charts(props) {
	const [memberCount, setMemberCount] = useState(memberCountCache);
	const [signupCount, setSignupCount] = useState(signupCountCache);

	useEffect(() => {
		requester('/charts/membercount/', 'GET')
		.then(res => {
			setMemberCount(res);
			memberCountCache = res;
		})
		.catch(err => {
			console.log(err);
		});

		requester('/charts/signupcount/', 'GET')
		.then(res => {
			setSignupCount(res);
			signupCountCache = res;
		})
		.catch(err => {
			console.log(err);
		});
	}, []);

	return (
		<Container>
			<Header size='large'>Charts</Header>

			<Header size='medium'>Member Counts</Header>

			<p>Daily since March 2nd, 2020.</p>

			<p>
				{memberCount &&
					<ResponsiveContainer width='100%' height={300}>
						<LineChart data={memberCount}>
							<XAxis dataKey='date' minTickGap={10} />
							<YAxis />
							<CartesianGrid strokeDasharray='3 3'/>
							<Tooltip />
							<Legend />

							<ReferenceLine x='2020-03-25' stroke='red' label='Space Locked' strokeDasharray='3 3' />

							<Line
								type='monotone'
								dataKey='member_count'
								name='Member Count'
								stroke='#8884d8'
								strokeWidth={2}
								dot={false}
								animationDuration={1000}
							/>
							<Line
								type='monotone'
								dataKey='green_count'
								name='Green Count'
								stroke='#82ca9d'
								strokeWidth={2}
								dot={false}
								animationDuration={1500}
							/>
						</LineChart>
					</ResponsiveContainer>
				}
			</p>

			<p>The Member Count is the amount of Prepaid, Current, Due, and Overdue members on Spaceport.</p>

			<p>The Green Count is the amount of Prepaid and Current members.</p>

			<Header size='medium'>Signup Count</Header>

			<p>Monthly for the last sixteen months.</p>

			<p>
				{signupCount &&
					<ResponsiveContainer width='100%' height={300}>
						<BarChart data={signupCount}>
							<XAxis dataKey='month' minTickGap={10} />
							<YAxis />
							<CartesianGrid strokeDasharray='3 3'/>
							<Tooltip />
							<Legend />

							<Bar
								type='monotone'
								dataKey='signup_count'
								name='Signup Count'
								fill='#8884d8'
								maxBarSize={30}
								animationDuration={1000}
							/>
						</BarChart>
					</ResponsiveContainer>
				}
			</p>

			<p>The Signup Count is the number of brand new account registrations per month.</p>

		</Container>
	);
};
