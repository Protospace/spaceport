import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Switch, Route, Link, useParams, useHistory } from 'react-router-dom';
import './light.css';
import { Button, Container, Checkbox, Dimmer, Divider, Dropdown, Form, Grid, Header, Icon, Image, Menu, Message, Segment, Table } from 'semantic-ui-react';
import moment from 'moment';
import { apiUrl, statusColor, BasicTable, staticUrl, requester } from './utils.js';
import { NotFound } from './Misc.js';
import { PayPalPayNow, PayPalSubscribe } from './PayPal.js';

export function Paymaster(props) {
	const { user } = props;

	return (
		<Container>
			<Header size='large'>Paymaster</Header>
			<p>Use these buttons to send money to Protospace.</p>

			<Header size='medium'>Snacks, Pop, Coffee</Header>
			<Grid stackable padded columns={3}>
				<Grid.Column>
					<p>Pay $5.00:</p>
					<PayPalPayNow
						amount={5}
						name='Protospace Snacks / Pop'
						custom={JSON.stringify({ category: 'Snacks', member: user.member.id })}
					/>
				</Grid.Column>

				<Grid.Column>
					<p>Pay $10.00:</p>
					<PayPalPayNow
						amount={10}
						name='Protospace Snacks / Pop'
						custom={JSON.stringify({ category: 'Snacks', member: user.member.id })}
					/>
				</Grid.Column>

				<Grid.Column>
					<p>Pay $20.00:</p>
					<PayPalPayNow
						amount={20}
						name='Protospace Snacks / Pop'
						custom={JSON.stringify({ category: 'Snacks', member: user.member.id })}
					/>
				</Grid.Column>
			</Grid>

			<Header size='medium'>Member Dues</Header>
			<Grid stackable padded columns={3}>
				<Grid.Column>
					<p>Pay ${user.member.monthly_fees}.00 once:</p>
					<PayPalPayNow
						amount={user.member.monthly_fees}
						name='Protospace Membership'
						custom={JSON.stringify({ member: user.member.id })}
					/>
				</Grid.Column>

				<Grid.Column>
					<p>Subscribe ${user.member.monthly_fees}.00 / month:</p>
					<PayPalSubscribe
						amount={user.member.monthly_fees}
						name='Protospace Membership'
						custom={JSON.stringify({ member: user.member.id })}
					/>
				</Grid.Column>

				<Grid.Column>
					<p>Pay ${user.member.monthly_fees * 11}.00 for a year:</p>
					<PayPalPayNow
						amount={user.member.monthly_fees * 11}
						name='Protospace Membership'
						custom={JSON.stringify({ deal: 12, member: user.member.id })}
					/>
					<p>...get one month for free!</p>
				</Grid.Column>
			</Grid>

			<Header size='medium'>Locker Storage</Header>

			<p>Confirm location and availability with Scott Y before subscribing.</p>

			<Grid stackable padded columns={3}>
				<Grid.Column>
					<p>Small $3.00 / month:</p>
					<PayPalSubscribe
						amount={3}
						name='Protospace Locker'
						custom={JSON.stringify({ memo: 'Small Locker', category: 'OnAcct', member: user.member.id })}
					/>
				</Grid.Column>

				<Grid.Column>
					<p>Medium $5.00 / month:</p>
					<PayPalSubscribe
						amount={5}
						name='Protospace Locker'
						custom={JSON.stringify({ memo: 'Medium Locker', category: 'OnAcct', member: user.member.id })}
					/>
				</Grid.Column>

				<Grid.Column>
					<p>Large $10.00 / month:</p>
					<PayPalSubscribe
						amount={10}
						name='Protospace Locker'
						custom={JSON.stringify({ memo: 'Large Locker', category: 'OnAcct', member: user.member.id })}
					/>
				</Grid.Column>
			</Grid>

			<Header size='medium'>Donate</Header>
			<Grid stackable padded columns={3}>
				<Grid.Column>
					<p>Donate $5.00:</p>
					<PayPalPayNow
						amount={5}
						name='Protospace Donation'
						custom={JSON.stringify({ reason: 'Donation', member: user.member.id })}
					/>
				</Grid.Column>

				<Grid.Column>
					<p>Donate $10.00:</p>
					<PayPalPayNow
						amount={10}
						name='Protospace Donation'
						custom={JSON.stringify({ reason: 'Donation', member: user.member.id })}
					/>
				</Grid.Column>

				<Grid.Column>
					<p>Donate $20.00:</p>
					<PayPalPayNow
						amount={20}
						name='Protospace Donation'
						custom={JSON.stringify({ reason: 'Donation', member: user.member.id })}
					/>
				</Grid.Column>
			</Grid>
		</Container>
	);
};
