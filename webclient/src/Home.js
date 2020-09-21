import React, { useState, useEffect, useReducer } from 'react';
import { BrowserRouter as Router, Switch, Route, Link, useParams, useLocation } from 'react-router-dom';
import moment from 'moment-timezone';
import './light.css';
import { Container, Divider, Dropdown, Form, Grid, Header, Icon, Image, Menu, Message, Popup, Segment, Table } from 'semantic-ui-react';
import { statusColor, BasicTable, staticUrl, requester, isAdmin } from './utils.js';
import { LoginForm, SignupForm } from './LoginSignup.js';
import { AccountForm } from './Account.js';
import { PayPalSubscribeDeal } from './PayPal.js';

function MemberInfo(props) {
	const user = props.user;
	const member = user.member;

	const lastTrans = user.transactions && user.transactions.slice(0,3);
	const lastCard = user.cards && user.cards.sort((a, b) => a.last_seen_at < b.last_seen_at)[0];

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
								<Table.Cell>{member.expire_date}</Table.Cell>
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
			</React.Fragment>}

			<Header size='medium'>Details</Header>
			<BasicTable>
				<Table.Body>
					<Table.Row>
						<Table.Cell>Application:</Table.Cell>
						<Table.Cell>{member.application_date || 'Unknown'}</Table.Cell>
					</Table.Row>
					<Table.Row>
						<Table.Cell>Start:</Table.Cell>
						<Table.Cell>{member.current_start_date || 'Unknown'}</Table.Cell>
					</Table.Row>
					<Table.Row>
						<Table.Cell>Vetted:</Table.Cell>
						<Table.Cell>{member.vetted_date || 'Not vetted'}</Table.Cell>
					</Table.Row>
					<Table.Row>
						<Table.Cell>Monthly:</Table.Cell>
						<Table.Cell>${member.monthly_fees || 'Unknown'}</Table.Cell>
					</Table.Row>
					<Table.Row>
						<Table.Cell>Card Number:</Table.Cell>
						<Table.Cell>
							{lastCard && lastCard.card_number || 'None'}
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

			<Header size='medium'>Latest Transactions</Header>
			<BasicTable>
				<Table.Body>
					{lastTrans.length ?
						lastTrans.map(x =>
							<Table.Row key={x.id}>
								<Table.Cell>
									<Link to={'/transactions/'+x.id}>{x.date}</Link>
								</Table.Cell>
								<Table.Cell>{x.account_type}</Table.Cell>
								<Table.Cell>${x.amount}</Table.Cell>
							</Table.Row>
						)
					:
						<Table.Row><Table.Cell>None</Table.Cell></Table.Row>
					}
				</Table.Body>
			</BasicTable>
		</div>
	);
};

export function Home(props) {
	const { user } = props;
	const [stats, setStats] = useState(JSON.parse(localStorage.getItem('stats', 'false')));
	const [refreshCount, refreshStats] = useReducer(x => x + 1, 0);
	const location = useLocation();

	const bypass_code = location.hash.replace('#', '');

	useEffect(() => {
		requester('/stats/', 'GET')
		.then(res => {
			setStats(res);
			localStorage.setItem('stats', JSON.stringify(res));
		})
		.catch(err => {
			console.log(err);
			setStats(false);
		});
	}, [refreshCount]);

	const getStat = (x) => stats && stats[x] ? stats[x] : '?';
	const getZeroStat = (x) => stats && stats[x] ? stats[x] : '0';
	const getDateStat = (x) => stats && stats[x] ? moment.utc(stats[x]).tz('America/Edmonton').format('ll') : '?';

	const mcPlayers = stats && stats['minecraft_players'] ? stats['minecraft_players'] : [];

	const getTrackStat = (x) => stats && stats.track && stats.track[x] ? moment().unix() - stats.track[x]['time'] > 60 ? 'Free' : 'In Use' : '?';
	const getTrackLast = (x) => stats && stats.track && stats.track[x] ? moment.unix(stats.track[x]['time']).tz('America/Edmonton').format('llll') : 'Unknown';
	const getTrackAgo = (x) => stats && stats.track && stats.track[x] ? moment.unix(stats.track[x]['time']).tz('America/Edmonton').fromNow() : '';
	const getTrackName = (x) => stats && stats.track && stats.track[x] && stats.track[x]['username'] ? stats.track[x]['username'] : 'Unknown';

	return (
		<Container>
			<Grid stackable padded columns={2}>
				<Grid.Column>
					{user ?
						user.member.set_details ?
							<MemberInfo user={user} />
						:
							<div>
								<Message warning>
									<Message.Header>Please submit your member details</Message.Header>
									<p>Press submit at the bottom if everything's correct.</p>
								</Message>

								<AccountForm {...props} />
							</div>
					:
						<div>
							{bypass_code ?
								<Message warning>
									<Message.Header>Outside Registration</Message.Header>
									<p>This page allows you to sign up from outside of Protospace.</p>
								</Message>
							:
								<>
									<LoginForm {...props} />

									<Divider section horizontal>Or</Divider>
								</>
							}

							<SignupForm {...props} />
						</div>
					}
				</Grid.Column>
				<Grid.Column>
					<Segment>
						<Header size='medium'>Home</Header>
						<p>Welcome to the Protospace member portal! Here you can view member info, join classes, and manage your membership.</p>

						<Header size='medium'>Quick Links</Header>
						<p><a href='http://protospace.ca/' target='_blank' rel='noopener noreferrer'>Main Website</a></p>
						<p><a href='http://wiki.protospace.ca/Welcome_to_Protospace' target='_blank' rel='noopener noreferrer'>Protospace Wiki</a></p>
						<p><a href='https://groups.google.com/forum/#!forum/protospace-discuss' target='_blank' rel='noopener noreferrer'>Discussion Google Group</a></p>
						<p><a href='https://groups.google.com/forum/#!forum/protospace-administration' target='_blank' rel='noopener noreferrer'>Admin Google Group</a></p>
						{!!user && <p><a href='https://drive.google.com/open?id=0By-vvp6fxFekfmU1cmdxaVRlaldiYXVyTE9rRnNVNjhkc3FjdkFIbjBwQkZ3MVVQX2Ezc3M' target='_blank' rel='noopener noreferrer'>Google Drive</a></p>}
						{!!user && isAdmin(user) && <p><a href='https://estancia.hippocmms.ca/' target='_blank' rel='noopener noreferrer'>Property Management Portal</a></p>}

						<img className='swordfish' src='/swordfish.png' onClick={() => refreshStats()} />

						<div>
							<Header size='medium'>Protospace Stats</Header>
							<p>Next member meeting: {getDateStat('next_meeting')}</p>
							<p>Next monthly clean: {getDateStat('next_clean')}</p>
							<p>Member count: {getStat('member_count')} <Link to='/charts'>[more]</Link></p>
							<p>Green members: {getStat('green_count')}</p>
							<p>Old members: {getStat('paused_count')}</p>
							<p>Card scans today: {getZeroStat('card_scans')}</p>

							<p>
								Minecraft players: {mcPlayers.length} <Popup content={
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
						</div>

					</Segment>
				</Grid.Column>
			</Grid>
		</Container>
	);
};
