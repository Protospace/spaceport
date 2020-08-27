import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Switch, Route, Link, useParams, useHistory } from 'react-router-dom';
import './light.css';
import { Button, Container, Checkbox, Dimmer, Divider, Dropdown, Form, Grid, Header, Icon, Image, Input, Menu, Message, Segment, Table } from 'semantic-ui-react';
import moment from 'moment';
import { apiUrl, statusColor, BasicTable, staticUrl, requester } from './utils.js';
import { NotFound } from './Misc.js';
import { PayPalPayNow, PayPalSubscribe } from './PayPal.js';

export function Paymaster(props) {
	const { user } = props;
	const [pop, setPop] = useState('20.00');
	const [locker, setLocker] = useState('5.00');
	const [donate, setDonate] = useState('20.00');

	const monthly_fees = user.member.monthly_fees || 55;

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
					Custom amount:

					<div className='pay-custom'>
						<Input
							fluid
							label={{ basic: true, content: '$' }}
							labelPosition='left'
							value={pop}
							onChange={(e, v) => setPop(v.value)}
						/>
					</div>

					<PayPalPayNow
						amount={pop}
						name='Protospace Donation'
						custom={JSON.stringify({ category: 'Donation', member: user.member.id })}
					/>
				</Grid.Column>
			</Grid>

			<Header size='medium'>Member Dues</Header>
			<Grid stackable padded columns={3}>
				<Grid.Column>
					<p>Pay ${monthly_fees}.00 once:</p>
					<PayPalPayNow
						amount={monthly_fees}
						name='Protospace Membership'
						custom={JSON.stringify({ member: user.member.id })}
					/>
				</Grid.Column>

				<Grid.Column>
					<p>Subscribe ${monthly_fees}.00 / month:</p>
					<PayPalSubscribe
						amount={monthly_fees}
						name='Protospace Membership'
						custom={JSON.stringify({ member: user.member.id })}
					/>
				</Grid.Column>

				<Grid.Column>
					<p>Pay ${monthly_fees * 11}.00 for a year:</p>
					<PayPalPayNow
						amount={monthly_fees * 11}
						name='Protospace Membership'
						custom={JSON.stringify({ deal: 12, member: user.member.id })}
					/>
					<p>...get one month for free!</p>
				</Grid.Column>
			</Grid>

			<Header size='medium'>Donate</Header>
			<Grid stackable padded columns={3}>
				<Grid.Column>
					<p>Donate $5.00:</p>
					<PayPalPayNow
						amount={5}
						name='Protospace Donation'
						custom={JSON.stringify({ category: 'Donation', member: user.member.id })}
					/>
				</Grid.Column>

				<Grid.Column>
					<p>Donate $10.00:</p>
					<PayPalPayNow
						amount={10}
						name='Protospace Donation'
						custom={JSON.stringify({ category: 'Donation', member: user.member.id })}
					/>
				</Grid.Column>

				<Grid.Column>
					Custom amount:

					<div className='pay-custom'>
						<Input
							fluid
							label={{ basic: true, content: '$' }}
							labelPosition='left'
							value={donate}
							onChange={(e, v) => setDonate(v.value)}
						/>
					</div>

					<PayPalPayNow
						amount={donate}
						name='Protospace Donation'
						custom={JSON.stringify({ category: 'Donation', member: user.member.id })}
					/>
				</Grid.Column>
			</Grid>

			<Header size='medium'>Locker Storage</Header>

			<p>Confirm location and availability with <Link to='/members/392'>Scott Young</Link> before subscribing.</p>

			<Grid stackable padded columns={1}>
				<Grid.Column>
					Custom amount:

					<div className='pay-custom'>
						<Input
							fluid
							label={{ basic: true, content: '$' }}
							labelPosition='left'
							value={locker}
							onChange={(e, v) => setLocker(v.value)}
						/>
					</div>

					<PayPalSubscribe
						amount={locker}
						name='Protospace Locker'
						custom={JSON.stringify({ memo: 'Locker Rental', category: 'OnAcct', member: user.member.id })}
					/>
				</Grid.Column>
			</Grid>
		</Container>
	);
};
