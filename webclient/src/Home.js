import React, { useState, useEffect, useReducer } from 'react';
import { BrowserRouter as Router, Switch, Route, Link, useParams, useLocation } from 'react-router-dom';
import moment from 'moment-timezone';
import QRCode from 'react-qr-code';
import './light.css';
import { Container, Divider, Dropdown, Form, Grid, Header, Icon, Image, Menu, Message, Popup, Segment, Table } from 'semantic-ui-react';
import { statusColor, BasicTable, siteUrl, staticUrl, requester, isAdmin } from './utils.js';
import { LoginForm, SignupForm } from './LoginSignup.js';
import { AccountForm } from './Account.js';
import { SignForm } from './Sign.js';
import { PayPalSubscribeDeal } from './PayPal.js';

function MemberInfo(props) {
	const user = props.user;
	const member = user.member;

	const lastTrans = user.transactions?.slice(0,3);
	const lastTrain = user.training?.sort((a, b) => a.session.datetime < b.session.datetime ? 1 : -1).slice(0,3);
	const lastCard = user.cards?.sort((a, b) => a.last_seen < b.last_seen)[0];

	return (
		<div>
			<Grid stackable>
				<Grid.Column width={5}>
					<Image
						size='small'
						src={member.photo_medium ? staticUrl + '/' + member.photo_medium : '/nophoto.png'}
					/>
				</Grid.Column>

				<Grid.Column width={11}>
					<Header size='large'>{member.preferred_name} {member.last_name}</Header>

					{member.is_allowed_entry ?
						<p>You are allowed entry into Protospace ✅</p>
					:
						<p>You are not allowed entry into Protospace ❌</p>
					}

					<BasicTable>
						<Table.Body>
							<Table.Row>
								<Table.Cell>Status:</Table.Cell>
								<Table.Cell>
									<Icon name='circle' color={statusColor[member.status]} />
									{member.status || 'Unknown'}
								</Table.Cell>
							</Table.Row>
							<Table.Row>
								<Table.Cell>Expiry:</Table.Cell>
								<Table.Cell>{member.expire_date ? moment(member.expire_date).format('ll') : 'Unknown'}</Table.Cell>
							</Table.Row>
						</Table.Body>
					</BasicTable>
				</Grid.Column>
			</Grid>

			{!member.photo_medium && <Message>
				<Message.Header>Welcome, new member!</Message.Header>
				<p>
					<a href={staticUrl + '/' + member.member_forms} target='_blank'>
						Click here
					</a> to view your application forms.
				</p>
			</Message>}

			{!!lastTrans.length && !member.photo_medium && <Message warning>
				<Message.Header>Please set a member photo!</Message.Header>
				<p>Visit the <Link to='/account'>account settings</Link> page to set one.</p>
			</Message>}

			{!lastTrans.length && <React.Fragment>
				<Header size='medium'>PayPal</Header>
				<p>Create a ${user.member.monthly_fees} / month subscription, get your first three months for the price of two:</p>
				<PayPalSubscribeDeal
					amount={user.member.monthly_fees}
					name='Protospace Membership'
					custom={JSON.stringify({ deal: 3, member: user.member.id })}
				/>

				<p>Click "Checkout as Guest" if you don't have a PayPal account.</p>

				<QRCode value={siteUrl + '/subscribe?monthly_fees=' + user.member.monthly_fees + '&id=' + user.member.id} />
			</React.Fragment>}

			<Header size='medium'>Latest Training</Header>
			<BasicTable>
				<Table.Body>
					{lastTrain.length ?
						lastTrain.map(x =>
							<Table.Row key={x.id}>
								<Table.Cell style={{ minWidth: '8rem' }}>
									<Link to={'/classes/'+x.session.id}>{moment(x.session.datetime).tz('America/Edmonton').format('ll')}</Link>
								</Table.Cell>
								<Table.Cell>{x.session.course_data.name}</Table.Cell>
							</Table.Row>
						)
					:
						<Table.Row><Table.Cell>None, please sign up for an <Link to={'/courses/249/'}>Orientation</Link></Table.Cell></Table.Row>
					}
					{user.training.length > 3 && <Link to='/training'>[more]</Link>}
				</Table.Body>
			</BasicTable>

			<Header size='medium'>Latest Transactions</Header>
			<BasicTable>
				<Table.Body>
					{lastTrans.length ?
						lastTrans.map(x =>
							<Table.Row key={x.id}>
								<Table.Cell style={{ minWidth: '8rem' }}>
									<Link to={'/transactions/'+x.id}>{moment(x.date).format('ll')}</Link>
								</Table.Cell>
								<Table.Cell>{x.account_type}</Table.Cell>
								<Table.Cell>${x.amount}</Table.Cell>
							</Table.Row>
						)
					:
						<Table.Row><Table.Cell>None</Table.Cell></Table.Row>
					}
					{user.transactions.length > 3 && <Link to='/transactions'>[more]</Link>}
				</Table.Body>
			</BasicTable>

			<Header size='medium'>Details</Header>
			<BasicTable>
				<Table.Body>
					<Table.Row>
						<Table.Cell>Application:</Table.Cell>
						<Table.Cell>{member.application_date ? moment(member.application_date).format('ll') : 'Unknown'}</Table.Cell>
					</Table.Row>
					<Table.Row>
						<Table.Cell>Start:</Table.Cell>
						<Table.Cell>{member.current_start_date ? moment(member.current_start_date).format('ll') : 'Unknown'}</Table.Cell>
					</Table.Row>
					<Table.Row>
						<Table.Cell>Vetted:</Table.Cell>
						<Table.Cell>{member.vetted_date ? moment(member.vetted_date).format('ll') : 'Not vetted'}</Table.Cell>
					</Table.Row>
					<Table.Row>
						<Table.Cell>Monthly dues:</Table.Cell>
						<Table.Cell>${member.monthly_fees || 'Unknown'}.00</Table.Cell>
					</Table.Row>
					<Table.Row>
						<Table.Cell>Last scan:</Table.Cell>
						<Table.Cell>
							{lastCard && lastCard.last_seen ?
								lastCard.last_seen > '2021-11-14T02:01:35.415685Z' ?
									moment.utc(lastCard.last_seen).tz('America/Edmonton').format('lll')
								:
									moment.utc(lastCard.last_seen).tz('America/Edmonton').format('ll')
							:
								'Unknown'
							}
							{user.cards.length > 1 && <Link to='/cards'> [more]</Link>}
						</Table.Cell>
					</Table.Row>
				</Table.Body>
			</BasicTable>

			{member.photo_medium && <p>
				<a href={staticUrl + '/' + member.member_forms} target='_blank'>
					View application forms
				</a>
			</p>}
		</div>
	);
};

export function Home(props) {
	const { user, token } = props;
	const [stats, setStats] = useState(JSON.parse(localStorage.getItem('stats', 'false')));
	const [refreshCount, refreshStats] = useReducer(x => x + 1, 0);
	const location = useLocation();

	useEffect(() => {
		requester('/stats/', 'GET', token)
		.then(res => {
			setStats(res);
			localStorage.setItem('stats', JSON.stringify(res));
		})
		.catch(err => {
			console.log(err);
			setStats(false);
		});
	}, [refreshCount, token]);

	const getStat = (x) => stats && stats[x] ? stats[x] : 'Unknown';
	const getZeroStat = (x) => stats && stats[x] ? stats[x] : '0';
	const getDateStat = (x) => stats && stats[x] ? moment.utc(stats[x]).tz('America/Edmonton').format('ll') : 'Unknown';

	const mcPlayers = stats && stats['minecraft_players'] ? stats['minecraft_players'] : [];
	const mumbleUsers = stats && stats['mumble_users'] ? stats['mumble_users'] : [];

	const getTrackStat = (x) => stats && stats.track && stats.track[x] ? moment().unix() - stats.track[x]['time'] > 60 ? 'Free' : 'In Use' : 'Unknown';
	const getTrackLast = (x) => stats && stats.track && stats.track[x] ? moment.unix(stats.track[x]['time']).tz('America/Edmonton').format('llll') : 'Unknown';
	const getTrackAgo = (x) => stats && stats.track && stats.track[x] ? moment.unix(stats.track[x]['time']).tz('America/Edmonton').fromNow() : '';
	const getTrackName = (x) => stats && stats.track && stats.track[x] && stats.track[x]['first_name'] ? stats.track[x]['first_name'] : 'Unknown';

	const alarmStat = () => stats && stats.alarm && moment().unix() - stats.alarm['time'] < 300 ? stats.alarm['data'] < 270 ? 'Armed' : 'Disarmed' : 'Unknown';

	const doorOpenStat = () => alarmStat() == 'Disarmed' && stats.alarm['data'] > 360 ? ', door open' : '';

	const show_signup = stats?.at_protospace;

	return (
		<Container>
			<Grid stackable padded columns={2}>
				<Grid.Column>
					{user ?
						user.member.set_details ?
							<MemberInfo user={user} />
						:
							<AccountForm {...props} />
					:
						<div>
							<LoginForm {...props} />

							<Divider section horizontal>Or</Divider>

							<SignupForm {...props} show_signup={show_signup} />
						</div>
					}
				</Grid.Column>

				<Grid.Column>
					{user.member.set_details &&
						<Segment>
							<Header size='medium'>Quick Links</Header>
							<p><a href='http://protospace.ca/' target='_blank' rel='noopener noreferrer'>Main Website</a></p>
							<p><a href='http://wiki.protospace.ca/Welcome_to_Protospace' target='_blank' rel='noopener noreferrer'>Protospace Wiki</a> — <Link to='/auth/wiki'>[register]</Link></p>
							<p><a href='https://forum.protospace.ca' target='_blank' rel='noopener noreferrer'>Protospace Forum</a> — <Link to='/auth/discourse'>[register]</Link></p>
							{!!user && <p><a href='https://drive.google.com/drive/folders/0By-vvp6fxFekfmU1cmdxaVRlaldiYXVyTE9rRnNVNjhkc3FjdkFIbjBwQkZ3MVVQX2Ezc3M?resourcekey=0-qVLjcYr8ZCmLypdINk2svg' target='_blank' rel='noopener noreferrer'>Google Drive</a></p>}
							{!!user && isAdmin(user) && <p><a href='https://estancia.hippocmms.ca/' target='_blank' rel='noopener noreferrer'>Property Management Portal</a></p>}

							<img className='swordfish' src='/swordfish.png' onClick={() => refreshStats()} />

							<div>
								<Header size='medium'>Protospace Stats</Header>
								<p>Next member meeting: {getDateStat('next_meeting')}</p>
								<p>Next monthly clean: {getDateStat('next_clean')}</p>
								<p>Member count: {getStat('member_count')} <Link to='/charts'>[more]</Link></p>
								<p>Green members: {getStat('green_count')}</p>
								<p>Card scans today: {getZeroStat('card_scans')}</p>

								<p>
									Minecraft players: {mcPlayers.length} {mcPlayers.length > 5 && '🔥'} <Popup content={
										<React.Fragment>
											<p>
												Server IP:<br />
												games.protospace.ca
											</p>
											<p>
												Players:<br />
												{mcPlayers.length ? mcPlayers.map(x => <React.Fragment>{x}<br /></React.Fragment>) : 'None'}
											</p>
										</React.Fragment>
									} trigger={<a>[more]</a>} />
								{' '}<a href='http://games.protospace.ca:8123/?worldname=world&mapname=flat&zoom=3&x=74&y=64&z=354' target='_blank'>[map]</a>
								</p>

								{stats && stats.hasOwnProperty('mumble_users') && <p>
									Mumble users: {mumbleUsers.length} <Popup content={
										<React.Fragment>
											<p>
												Server IP:<br />
												mumble.protospace.ca
											</p>
											<p>
												Users:<br />
												{mumbleUsers.length ? mumbleUsers.map(x => <React.Fragment>{x}<br /></React.Fragment>) : 'None'}
											</p>
										</React.Fragment>
									} trigger={<a>[more]</a>} />
								</p>}

								<p>
									Trotec availability: {getTrackStat('TROTECS300')} <Popup content={
										<React.Fragment>
											<p>
												Last use:<br />
												{getTrackLast('TROTECS300')}<br />
												{getTrackAgo('TROTECS300')}<br />
												by {getTrackName('TROTECS300')}
											</p>
										</React.Fragment>
									} trigger={<a>[more]</a>} />
								</p>

								<p>
									Rabbit availability: {getTrackStat('FRICKIN-LASER')} <Popup content={
										<React.Fragment>
											<p>
												Last use:<br />
												{getTrackLast('FRICKIN-LASER')}<br />
												{getTrackAgo('FRICKIN-LASER')}<br />
												by {getTrackName('FRICKIN-LASER')}
											</p>
										</React.Fragment>
									} trigger={<a>[more]</a>} />
								</p>

								<p>
									Precix availability: {getTrackStat('CNC-PRECIX')} <Popup content={
										<React.Fragment>
											<p>
												Last use:<br />
												{getTrackLast('CNC-PRECIX')}<br />
												{getTrackAgo('CNC-PRECIX')}<br />
												by {getTrackName('CNC-PRECIX')}
											</p>
										</React.Fragment>
									} trigger={<a>[more]</a>} />
								</p>

								{user && <p>Alarm status: {alarmStat()}{doorOpenStat()}</p>}
							</div>

							<SignForm token={token} />

						</Segment>
					}
				</Grid.Column>
			</Grid>
		</Container>
	);
};
