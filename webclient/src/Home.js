import React, { useState, useEffect, useReducer } from 'react';
import { Link, useParams, useHistory } from 'react-router-dom';
import moment from 'moment-timezone';
import QRCode from 'react-qr-code';
import './light.css';
import { Button, Container, Divider, Grid, Header, Icon, Image, Message, Popup, Segment, Table } from 'semantic-ui-react';
import { statusColor, BasicTable, siteUrl, staticUrl, requester, isAdmin } from './utils.js';
import { LoginForm, SignupForm } from './LoginSignup.js';
import { AccountForm } from './Account.js';
import { SignForm } from './Sign.js';
import { StorageButton } from './Storage.js';
import { PayPalSubscribeDeal } from './PayPal.js';

function MemberInfo(props) {
	const user = props.user;
	const member = user.member;
	const history = useHistory();

	const lastTrans = user.transactions?.slice(0,3);
	const lastTrain = user.training?.sort((a, b) => a.session.datetime < b.session.datetime ? 1 : -1).slice(0,3);
	const lastCard = user.cards?.filter(x => x.last_seen).sort((a, b) => a.last_seen < b.last_seen ? 1 : -1)[0];

	const unpaidTraining = user.training?.filter(x => x.attendance_status === 'Waiting for payment');

	return (
		<div>
			{member.protocoin < 0 && <Message error>
				<Message.Header>Your Protocoin balance is negative!</Message.Header>
				<p>Visit the <Link to='/paymaster'>Paymaster</Link> page or pay a Director to buy Protocoin.</p>
			</Message>}

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
						<></>
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
								<Table.Cell>Paid until:</Table.Cell>
								<Table.Cell>{member.expire_date ? moment(member.expire_date).format('ll') : 'Unknown'}</Table.Cell>
							</Table.Row>
							<Table.Row>
								<Table.Cell>Protocoin:</Table.Cell>
								<Table.Cell>₱&thinsp;{member.protocoin.toFixed(2)} <Link to='/paymaster'>[buy]</Link></Table.Cell>
							</Table.Row>
							<Table.Row>
								<Table.Cell>Shelf:</Table.Cell>
								<Table.Cell>
									{user.storage.length ?
										user.storage.sort((a, b) => a.location === 'member_shelves' ? -1 : 1).map((x, i) =>
											<StorageButton storage={x} />
										)
									:
										<>None <Link to='/claimshelf'>[claim]</Link></>
									}
								</Table.Cell>
							</Table.Row>
						</Table.Body>
					</BasicTable>
				</Grid.Column>
			</Grid>

			{!lastTrans.length && <Message>
				<Message.Header>Welcome, new member!</Message.Header>
				<p>
					<a href={staticUrl + '/' + member.member_forms} target='_blank'>
						View your application forms.
					</a>
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

				<QRCode value={siteUrl + 'subscribe?monthly_fees=' + user.member.monthly_fees + '&id=' + user.member.id} />
			</React.Fragment>}

			{unpaidTraining.map(x =>
				<Message warning>
					<Message.Header>Please pay your course fee!</Message.Header>
					<p>Pay ${x.session.cost} for <Link to={'/classes/'+x.session.id}>{x.session.course_data.name}</Link> to avoid losing your spot.</p>
				</Message>
			)}

			<Header size='medium'>Latest Training</Header>

			{!member.orientation_date && <p>
				⚠️ You need to attend a <Link to={'/courses/249/'}>New Member Orientation</Link> to use any tool larger than a screwdriver.
			</p>}

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
						<Table.Row><Table.Cell>None</Table.Cell></Table.Row>
					}
					{user.training.length > 3 &&
						<Table.Row><Table.Cell>
							<Link to='/training'>[more]</Link>
						</Table.Cell><Table.Cell/></Table.Row>
					}
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
								<Table.Cell>{x.protocoin !== '0.00' ? '₱ ' + x.protocoin : '$ ' + x.amount}</Table.Cell>
							</Table.Row>
						)
					:
						<Table.Row><Table.Cell>None</Table.Cell></Table.Row>
					}
					{user.transactions.length > 3 &&
						<Table.Row><Table.Cell>
							<Link to='/transactions'>[more]</Link>
						</Table.Cell><Table.Cell/><Table.Cell/></Table.Row>
					}
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

			{!!lastTrans.length && <p>
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
	const getDateStat = (x) => stats && stats[x] ? moment.utc(stats[x]).tz('America/Edmonton').format('MMM Do @ LT') : 'Unknown';

	const getNextStat = (x) => {
		if (stats && stats[x]) {
			const datetime = moment.utc(stats[x].datetime).tz('America/Edmonton');
			if (datetime.isSame(moment().tz('America/Edmonton'), 'day') ) {
				return <>{datetime.format('LT')} | <Link to={'/classes/' + stats[x].id}>{stats[x].name}</Link></>;
			} else {
				return <>{datetime.format('MMM Do')} | <Link to={'/classes/' + stats[x].id}>{stats[x].name}</Link></>;
			}
		} else {
			return 'Unknown';
		}
	};

	const mcPlayers = stats && stats['minecraft_players'] ? stats['minecraft_players'] : [];
	const mumbleUsers = stats && stats['mumble_users'] ? stats['mumble_users'] : [];

	const getTrackStat = (x) => stats && stats.track && stats.track[x] ? moment().unix() - stats.track[x]['time'] > 60 ? 'Free' : 'In Use' : 'Unknown';
	const getTrackLast = (x) => stats && stats.track && stats.track[x] ? moment.unix(stats.track[x]['time']).tz('America/Edmonton').format('llll') : 'Unknown';
	const getTrackAgo = (x) => stats && stats.track && stats.track[x] ? moment.unix(stats.track[x]['time']).tz('America/Edmonton').fromNow() : '';
	const getTrackName = (x) => stats && stats.track && stats.track[x] && stats.track[x]['first_name'] ? stats.track[x]['first_name'] : 'Unknown';

	const alarmStat = (x) => stats && stats.alarm && moment().unix() - stats.alarm.time < 60*60*24 ? stats.alarm.data : 'Unknown';
	const alarmUpdateLast = (x) => stats && stats.alarm ? moment.unix(stats.alarm.time).tz('America/Edmonton').format('llll') : 'Unknown';
	const alarmUpdateAgo = (x) => stats && stats.alarm ? moment.unix(stats.alarm.time).tz('America/Edmonton').fromNow() : 'Unknown';

	const closedStat = (x) => stats && stats.closing ? moment().unix() > stats.closing['time'] ? 'Closed' : 'Open until ' + stats.closing['time_str'] + ' with ' + stats.closing['first_name'] : 'Unknown';

	const printer3dStat = (x) => stats && stats.printer3d && stats.printer3d[x] ? stats.printer3d[x].state === 'Printing' ? 'Printing (' + stats.printer3d[x].progress + '%)' : stats.printer3d[x].state : 'Unknown';

	const show_signup = stats?.at_protospace;

	const setLightMode = () => {
		document.body.className = '';
		localStorage.setItem('darkmode', false);
	};

	const setDarkMode = () => {
		document.body.className = 'dark';
		localStorage.setItem('darkmode', true);
	};


	return (
		<Container>
			<Grid stackable columns={2}>
				<Grid.Column>
					{user ?
						user.member.set_details ?
							<MemberInfo user={user} />
						:
							<AccountForm {...props} isSignup={true} />
					:
						<div>
							<LoginForm {...props} />

							<Divider section horizontal>Or</Divider>

							<SignupForm {...props} show_signup={show_signup} />
						</div>
					}
				</Grid.Column>

				<Grid.Column>
					{user?.member?.set_details !== false &&
						<Segment>
							<Header size='medium'>Quick Links</Header>
							<p><a href='https://protospace.ca/' target='_blank' rel='noopener noreferrer'>Main Website</a></p>
							<p><a href='https://wiki.protospace.ca/Welcome_to_Protospace' target='_blank' rel='noopener noreferrer'>Protospace Wiki</a> — <Link to='/auth/wiki'>[register]</Link></p>
							<p><a href='https://forum.protospace.ca' target='_blank' rel='noopener noreferrer'>Forum (Spacebar)</a> — <Link to='/auth/discourse'>[register]</Link></p>
							{!!user && <p><a href='https://drive.google.com/drive/folders/0By-vvp6fxFekfmU1cmdxaVRlaldiYXVyTE9rRnNVNjhkc3FjdkFIbjBwQkZ3MVVQX2Ezc3M?resourcekey=0-qVLjcYr8ZCmLypdINk2svg' target='_blank' rel='noopener noreferrer'>Google Drive</a></p>}
							{!!user && isAdmin(user) && <p><a href='https://estancia.hippocmms.ca/' target='_blank' rel='noopener noreferrer'>Property Management Portal</a></p>}
							<p>Spaceport theme: <a onClick={setLightMode}>Light</a> / <a onClick={setDarkMode}>Dark</a></p>

							<img className='swordfish' src='/swordfish.png' onClick={() => refreshStats()} />

							<div>
								<Header size='medium'>Protospace Stats</Header>
								<p>Next meeting: {getDateStat('next_meeting')}</p>
								<p>Next clean: {getDateStat('next_clean')}</p>
								<p className='nowrap-stat'>Next class: {getNextStat('next_class')}</p>
								<p className='nowrap-stat'>Last class: {getNextStat('prev_class')}</p>
								<p>Member count: {getStat('member_count')} <Link to='/charts'>[charts]</Link></p>
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

								<p>
									Media computer: {getTrackStat('PROTOGRAPH1')} <Popup content={
										<React.Fragment>
											<p>
												Last use:<br />
												{getTrackLast('PROTOGRAPH1')}<br />
												{getTrackAgo('PROTOGRAPH1')}<br />
												by {getTrackName('PROTOGRAPH1')}
											</p>

											<p>
												Last print:<br />
												{getTrackLast('LASTLARGEPRINT')}<br />
												{getTrackAgo('LASTLARGEPRINT')}<br />
												by {getTrackName('LASTLARGEPRINT')}
											</p>
										</React.Fragment>
									} trigger={<a>[more]</a>} />
								</p>

								<p>ORD2 printer: {printer3dStat('ord2')}</p>

								<p>ORD3 printer: {printer3dStat('ord3')}</p>

								{user ?
									<p>
										Alarm status: {alarmStat()} <Popup content={
											<React.Fragment>
												<p>
													Last update:<br />
													{alarmUpdateLast()}<br />
													{alarmUpdateAgo()}
												</p>
											</React.Fragment>
										} trigger={<a>[more]</a>} />
									</p>
								:
									<p>Alarm status: Unauthorized</p>
								}

								{user && <p>Hosting status: {closedStat()}</p>}
							</div>

							<SignForm token={token} />

							<p>Protogarden:</p>

							<Link to='/garden'>
								<Image src={staticUrl + '/garden-medium.jpg'} />
							</Link>

						</Segment>
					}
				</Grid.Column>
			</Grid>
		</Container>
	);
};
