import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import './light.css';
import { Container, Grid, Header, Input } from 'semantic-ui-react';
import { PayPalPayNow, PayPalSubscribe } from './PayPal.js';

export function Paymaster(props) {
	const { user } = props;
	const [pop, setPop] = useState('20.00');
	const [locker, setLocker] = useState('5.00');
	const [consumables, setConsumables] = useState('20.00');
	const [consumablesMemo, setConsumablesMemo] = useState('');
	const [donate, setDonate] = useState('20.00');
	const [memo, setMemo] = useState('');

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
						name='Protospace Snacks / Pop'
						custom={JSON.stringify({ category: 'Snacks', member: user.member.id })}
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

			<Header size='medium'>Consumables</Header>

			<p>Pay for materials you use (ie. welding gas, 3D printing, blades, etc).</p>

			<Grid stackable padded columns={1}>
				<Grid.Column>
					Custom amount:

					<div className='pay-custom'>
						<Input
							fluid
							label={{ basic: true, content: '$' }}
							labelPosition='left'
							value={consumables}
							onChange={(e, v) => setConsumables(v.value)}
						/>
					</div>

					<p>
						Please explain what you bought:<br/>
						<Input
							value={consumablesMemo}
							maxLength={50}
							onChange={(e, v) => setConsumablesMemo(v.value)}
						/>
					</p>

					<PayPalPayNow
						amount={consumables}
						name='Protospace Consumables'
						custom={JSON.stringify({ category: 'Consumables', member: user.member.id, memo: consumablesMemo })}
					/>
				</Grid.Column>
			</Grid>

			<Header size='medium'>Donate</Header>

			<Grid stackable padded columns={1}>
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

					<p>
						Optional memo:<br/>
						<Input
							value={memo}
							maxLength={50}
							onChange={(e, v) => setMemo(v.value)}
						/>
					</p>

					<PayPalPayNow
						amount={donate}
						name='Protospace Donation'
						custom={JSON.stringify({ category: 'Donation', member: user.member.id, memo: memo })}
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
						custom={JSON.stringify({ memo: 'Locker Rental', category: 'Purchases', member: user.member.id })}
					/>
				</Grid.Column>
			</Grid>
		</Container>
	);
};
