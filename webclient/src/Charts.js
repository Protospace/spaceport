import React, { useState, useEffect } from 'react';
import { Statistic, Button, Container, Header } from 'semantic-ui-react';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine } from 'recharts';
import { requester, useIsMobile } from './utils.js';
import moment from 'moment-timezone';

let memberCountCache = false;
let signupCountCache = false;
let spaceActivityCache = false;
let extrasCache = false;

export function Charts(props) {
	const [memberCount, setMemberCount] = useState(memberCountCache);
	const [signupCount, setSignupCount] = useState(signupCountCache);
	const [spaceActivity, setSpaceActivity] = useState(spaceActivityCache);
	const [fullActivity, setFullActivity] = useState(false);
	const [fullSignups, setFullSignups] = useState(false);
	const [extras, setExtras] = useState(extrasCache);
	const isMobile = useIsMobile();

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

		requester('/stats/extras/', 'GET')
		.then(res => {
			setExtras(res);
			extrasCache = res;
		})
		.catch(err => {
			console.log(err);
		});
	}, []);

	return (
		<Container>
			<Header size='large'>Charts</Header>

			{memberCount.length > 30 && signupCount.length > 1 &&
				<>
					<div className='chartstats'>
						<Statistic
							color='blue'
							value={memberCount.slice().reverse()[0].member_count}
							label='Members'
						/>

						<Statistic
							color='green'
							value={memberCount.slice().reverse()[0].green_count}
							label='Green'
						/>

						<Statistic
							color='red'
							value={memberCount.slice().reverse()[0].six_month_plus_count}
							label='Six Month+'
						/>

						<Statistic
							color='purple'
							value={memberCount.slice().reverse()[0].vetted_count}
							label='Vetted'
						/>

						<Statistic
							color='orange'
							value={memberCount.slice().reverse()[0].subscriber_count}
							label='PayPal Subs'
						/>

						<Statistic
							color='black'
							value={signupCount.slice().reverse()[0].signup_count}
							label='Signups'
						/>
					</div>

					<p>
						The total member count is {memberCount.slice().reverse()[0].member_count} members,
						compared to {memberCount.slice().reverse()[30].member_count} members 30 days ago.
					</p>
					<p>
						The green member count is {memberCount.slice().reverse()[0].green_count} members,
						compared to {memberCount.slice().reverse()[30].green_count} members 30 days ago.
					</p>
					<p>
						The older than six months member count is {memberCount.slice().reverse()[0].six_month_plus_count} members,
						compared to {memberCount.slice().reverse()[30].six_month_plus_count} members 30 days ago.
					</p>
					<p>
						The vetted member count is {memberCount.slice().reverse()[0].vetted_count} members,
						compared to {memberCount.slice().reverse()[30].vetted_count} members 30 days ago.
					</p>
					<p>
						There were {signupCount.slice().reverse()[0].signup_count} signups so far this month,
						and {signupCount.slice().reverse()[1].signup_count} signups last month.
					</p>
				</>
			}

			<Header size='medium'>Member Counts</Header>

			<p>Daily since March 2nd, 2020.</p>

			<Header size='small'>Total Members</Header>

			<p>
				{memberCount &&
					<ResponsiveContainer width='100%' height={300}>
						<LineChart syncId={1} data={memberCount}>
							<XAxis dataKey='date' minTickGap={10} />
							<YAxis />
							<CartesianGrid strokeDasharray='3 3'/>
							<Tooltip />
							<Legend />

							<Line
								type='monotone'
								dataKey='member_count'
								name='Member Count'
								stroke='#2185d0'
								strokeWidth={2}
								dot={false}
								animationDuration={250}
							/>
							<Line
								type='monotone'
								dataKey='green_count'
								name='Green Count'
								stroke='#21ba45'
								strokeWidth={2}
								dot={false}
								animationDuration={500}
							/>
						</LineChart>
					</ResponsiveContainer>
				}
			</p>

			<Header size='small'>Six Month+ Members</Header>

			<p>
				{memberCount &&
					<ResponsiveContainer width='100%' height={300}>
						<LineChart syncId={1} data={memberCount}>
							<XAxis dataKey='date' minTickGap={10} />
							<YAxis />
							<CartesianGrid strokeDasharray='3 3'/>
							<Tooltip />
							<Legend />

							<Line
								type='monotone'
								dataKey='member_count'
								name='Member Count'
								stroke='#2185d0'
								strokeWidth={2}
								dot={false}
								animationDuration={250}
							/>
							<Line
								type='monotone'
								dataKey='six_month_plus_count'
								name='Six Month+'
								stroke='#db2828'
								strokeWidth={2}
								dot={false}
								animationDuration={500}
							/>
						</LineChart>
					</ResponsiveContainer>
				}
			</p>

			<Header size='small'>Vetted Members</Header>

			<p>
				{memberCount &&
					<ResponsiveContainer width='100%' height={300}>
						<LineChart syncId={1} data={memberCount}>
							<XAxis dataKey='date' minTickGap={10} />
							<YAxis />
							<CartesianGrid strokeDasharray='3 3'/>
							<Tooltip />
							<Legend />

							<Line
								type='monotone'
								dataKey='member_count'
								name='Member Count'
								stroke='#2185d0'
								strokeWidth={2}
								dot={false}
								animationDuration={250}
							/>
							<Line
								type='monotone'
								dataKey='vetted_count'
								name='Vetted Count'
								stroke='#a333c8'
								strokeWidth={2}
								dot={false}
								animationDuration={500}
							/>
						</LineChart>
					</ResponsiveContainer>
				}
			</p>

			<Header size='small'>PayPal Subscribers</Header>

			<p>
				{memberCount &&
					<ResponsiveContainer width='100%' height={300}>
						<LineChart syncId={1} data={memberCount}>
							<XAxis dataKey='date' minTickGap={10} />
							<YAxis />
							<CartesianGrid strokeDasharray='3 3'/>
							<Tooltip />
							<Legend />

							<Line
								type='monotone'
								dataKey='member_count'
								name='Member Count'
								stroke='#2185d0'
								strokeWidth={2}
								dot={false}
								animationDuration={250}
							/>
							<Line
								type='monotone'
								dataKey='subscriber_count'
								name='PayPal Subscriber Count'
								stroke='#f2711c'
								strokeWidth={2}
								dot={false}
								animationDuration={500}
							/>
						</LineChart>
					</ResponsiveContainer>
				}
			</p>

			<p>Member Count: number of active paying members on Spaceport.</p>

			<p>Green Count: number of Prepaid and Current members.</p>

			<p>Six Months+: number of active memberships older than six months.</p>

			<p>Vetted Count: number of active vetted members.</p>

			<p>PayPal Subscriber Count: number of members with a PayPal subscription.</p>

			<Header size='medium'>Space Activity</Header>

			{fullActivity ?
				<p>Daily since March 7th 2020, updates hourly.</p>
			:
				<p>
					Last four weeks, updates hourly.
					{' '}<Button size='tiny' onClick={() => setFullActivity(true)} >View All</Button>
				</p>
			}

			<p>
				{spaceActivity &&
					<ResponsiveContainer width='100%' height={300}>
						<BarChart data={fullActivity ? spaceActivity : spaceActivity.slice(-28)}>
							<XAxis dataKey='date' minTickGap={10} />
							<YAxis />
							<CartesianGrid strokeDasharray='3 3'/>
							<Tooltip labelFormatter={t => moment(t).format('YYYY-MM-DD ddd')} />
							<Legend />

							<Bar
								type='monotone'
								dataKey='card_scans'
								name='Card Scans'
								fill='#2185d0'
								maxBarSize={20}
								isAnimationActive={false}
							/>
						</BarChart>
					</ResponsiveContainer>
				}
			</p>

			<p>Cards Scans: number of individual members who have scanned to enter the space.</p>

			<Header size='medium'>Signup Count</Header>


			{fullSignups ?
				<p>Monthly since January 2019, updates daily.</p>
			:
				<p>
					Monthly for the last sixteen months, updates daily.
					{' '}<Button size='tiny' onClick={() => setFullSignups(true)} >View All</Button>
				</p>
			}

			<p>
				{signupCount &&
					<ResponsiveContainer width='100%' height={300}>
						<BarChart data={fullSignups ? signupCount : signupCount.slice(-16)}>
							<XAxis dataKey='month' minTickGap={10} />
							<YAxis />
							<CartesianGrid strokeDasharray='3 3'/>
							<Tooltip />
							<Legend />

							<Bar
								type='monotone'
								dataKey='signup_count'
								name='Signup Count'
								fill='#2185d0'
								maxBarSize={20}
								animationDuration={250}
							/>
							<Bar
								type='monotone'
								dataKey='vetted_count'
								fill='#80b3d3'
								name='Later Vetted Count'
								maxBarSize={20}
								animationDuration={1200}
							/>
							<Bar
								type='monotone'
								dataKey='retain_count'
								name='Retained Count'
								fill='#82ca9d'
								maxBarSize={20}
								animationDuration={1400}
							/>
						</BarChart>
					</ResponsiveContainer>
				}
			</p>

			<p>Signup Count: number of brand new account registrations that month.</p>

			<p>Later Vetted Count: number of those signups who eventually got vetted (at a later date).</p>

			<p>Retained Count: number of those signups who are still a member currently.</p>

			<Header size='medium'>Drink Sales</Header>

			<p>Drinks sold over the last six months via Protocoin. Excludes instructor comped vends.</p>

			<p>
				{!!extras?.drinks_6mo?.length &&
					<ResponsiveContainer width='100%' height={300}>
						<BarChart
							margin={isMobile? {bottom: 50} : {}}
							data={extras.drinks_6mo}
						>
							<XAxis dataKey='name' interval={0} angle={isMobile ? -45 : 0} textAnchor={isMobile ? 'end' : 'middle'} />
							<YAxis />
							<CartesianGrid strokeDasharray='3 3'/>
							<Tooltip />

							<Bar
								type='monotone'
								dataKey='count'
								name='Cans'
								fill='#2185d0'
								maxBarSize={40}
								animationDuration={250}
							/>
						</BarChart>
					</ResponsiveContainer>
				}
			</p>

			<p>Count: number of cans of pop sold over the last six months.</p>

			<Header size='medium'>Dues Distribution</Header>

			<p>Distribution of monthly dues for active members.</p>

			<p>
				{!!extras?.dues_dist?.length &&
					(() => {
						const total = extras.dues_dist.reduce((acc, item) => acc + item.count, 0);
						return (
							<ResponsiveContainer width='100%' height={300}>
								<BarChart data={extras.dues_dist}>
									<XAxis dataKey='monthly_fees' tickFormatter={val => `$${val}`} />
									<YAxis />
									<CartesianGrid strokeDasharray='3 3'/>
									<Tooltip
										formatter={(value) => `${value} (${(value / total * 100).toFixed(1)}%)`}
										labelFormatter={label => `$${label}`}
									/>

									<Bar
										type='monotone'
										dataKey='count'
										name='Members'
										fill='#2185d0'
										maxBarSize={40}
										animationDuration={250}
									/>
								</BarChart>
							</ResponsiveContainer>
						);
					})()
				}
			</p>

			<p>Count: number of members paying a certain amount monthly.</p>

			<Header size='medium'>Signup Year Distribution</Header>

			<p>Distribution of active members by their signup year.</p>

			<p>
				{!!extras?.year_dist?.length &&
					(() => {
						const total = extras.year_dist.reduce((acc, item) => acc + item.count, 0);
						return (
							<ResponsiveContainer width='100%' height={300}>
								<BarChart data={extras.year_dist}>
									<XAxis dataKey='application_date__year' />
									<YAxis />
									<CartesianGrid strokeDasharray='3 3'/>
									<Tooltip formatter={(value) => `${value} (${(value / total * 100).toFixed(1)}%)`} />

									<Bar
										type='monotone'
										dataKey='count'
										name='Members'
										fill='#2185d0'
										maxBarSize={40}
										animationDuration={250}
									/>
								</BarChart>
							</ResponsiveContainer>
						);
					})()
				}
			</p>

			<p>Count: number of members who signed up in a given year who are still active.</p>

			<Header size='medium'>Certification Distribution</Header>

			<p>Number of active members with each certification.</p>

			<p>
				{!!extras?.cert_dist?.length &&
					(() => {
						const total = extras.dues_dist.reduce((acc, item) => acc + item.count, 0);
						return (
							<ResponsiveContainer width='100%' height={300}>
								<BarChart
									margin={isMobile? {bottom: 80} : {}}
									data={extras.cert_dist}
								>
									<XAxis dataKey='name' interval={0} angle={isMobile ? -45 : 0} textAnchor={isMobile ? 'end' : 'middle'} />
									<YAxis />
									<CartesianGrid strokeDasharray='3 3'/>
									<Tooltip formatter={(value) => {
										const percentage = total > 0 ? (value / total * 100).toFixed(1) : 0;
										return `${value} (${percentage}%)`;
									}} />

									<Bar
										type='monotone'
										dataKey='count'
										name='Members'
										fill='#2185d0'
										maxBarSize={40}
										animationDuration={250}
									/>
								</BarChart>
							</ResponsiveContainer>
						);
					})()
				}
			</p>

			<p>Count: number of active members with the given certification.</p>

			<Header size='medium'>Forum Activity</Header>

			<p>Distribution of forum visit days by active members in the last month. Taken from <a href="https://forum.protospace.ca/u?group=protospace_members&order=days_visited&period=monthly">here</a>.</p>

			<p>
				{!!extras?.forums_visit_1mo?.length &&
					<ResponsiveContainer width='100%' height={300}>
						<BarChart data={extras.forums_visit_1mo}>
							<XAxis dataKey='member' tick={false} />
							<YAxis />
							<CartesianGrid strokeDasharray='3 3'/>
							<Tooltip labelFormatter={label => `Member ${label} (${(label / extras.forums_visit_1mo.length * 100).toFixed(0)}%)`} />
							<Bar
								dataKey='days_visited'
								name='Days Visited'
								fill='#2185d0'
								animationDuration={250}
							/>
						</BarChart>
					</ResponsiveContainer>
				}
			</p>

			<p>Each bar represents an active member's visit count to the forum in the last month, sorted by activity.</p>

		</Container>
	);
};
