import React, { useState, useEffect, useReducer, useContext } from 'react';
import { BrowserRouter as Router, Switch, Route, Link, useParams, useHistory } from 'react-router-dom';
import { Button, Container, Checkbox, Dimmer, Divider, Dropdown, Form, Grid, Header, Icon, Image, Menu, Message, Segment, Table } from 'semantic-ui-react';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine } from 'recharts';
import { apiUrl, statusColor, BasicTable, staticUrl, requester } from './utils.js';
import { NotFound } from './Misc.js';

let memberCountCache = false;
let signupCountCache = false;
let spaceActivityCache = false;

export function Charts(props) {
	const [memberCount, setMemberCount] = useState(memberCountCache);
	const [signupCount, setSignupCount] = useState(signupCountCache);
	const [spaceActivity, setSpaceActivity] = useState(spaceActivityCache);

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

		requester('/charts/spaceactivity/', 'GET')
		.then(res => {
			setSpaceActivity(res);
			spaceActivityCache = res;
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
							<ReferenceLine x='2020-06-01' stroke='red' label='Space Opened' strokeDasharray='3 3' />

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

			<Header size='medium'>Space Activity</Header>

			<p>Daily since March 7th, 2020, updates hourly.</p>

			<p>
				{spaceActivity &&
					<ResponsiveContainer width='100%' height={300}>
						<BarChart data={spaceActivity}>
							<XAxis dataKey='date' minTickGap={10} />
							<YAxis />
							<CartesianGrid strokeDasharray='3 3'/>
							<Tooltip />
							<Legend />

							<Bar
								type='monotone'
								dataKey='card_scans'
								name='Card Scans'
								fill='#8884d8'
								maxBarSize={20}
								animationDuration={1000}
							/>
						</BarChart>
					</ResponsiveContainer>
				}
			</p>

			<p>Cards Scans is the number of individual members who have scanned to enter the space.</p>

			<Header size='medium'>Signup Count</Header>

			<p>Monthly for the last sixteen months, updates daily.</p>

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
								maxBarSize={20}
								animationDuration={1000}
							/>
							<Bar
								type='monotone'
								dataKey='vetted_count'
								fill='#80b3d3'
								name='Vetted Count'
								maxBarSize={20}
								animationDuration={1200}
							/>
							<Bar
								type='monotone'
								dataKey='retain_count'
								name='Retain Count'
								fill='#82ca9d'
								maxBarSize={20}
								animationDuration={1400}
							/>
						</BarChart>
					</ResponsiveContainer>
				}
			</p>

			<p>The Signup Count is the number of brand new account registrations that month.</p>

			<p>The Vetted Count is the number of those signups who eventually got vetted (at a later date).</p>

			<p>The Retain Count is the number of those signups who are still a member currently.</p>

		</Container>
	);
};
