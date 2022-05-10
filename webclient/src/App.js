import React, { useState, useEffect, useReducer, useContext } from 'react';
import { BrowserRouter as Router, Switch, Route, Link, useParams, useHistory } from 'react-router-dom';
import './semantic-ui/semantic.min.css';
import './light.css';
import './dark.css';
import { Container, Divider, Dropdown, Form, Grid, Header, Icon, Image, Menu, Message, Segment, Table } from 'semantic-ui-react';
import Darkmode from 'darkmode-js';
import { isAdmin, requester } from './utils.js';
import { ManageScroll } from './ManageScroll.js';
import { Home } from './Home.js';
import { Account } from './Account.js';
import { Transactions, TransactionDetail } from './Transactions.js';
import { Paymaster } from './Paymaster.js';
import { Cards } from './Cards.js';
import { Training } from './Training.js';
import { AdminTransactions } from './AdminTransactions.js';
import { Admin } from './Admin.js';
import { Paste } from './Paste.js';
import { Sign } from './Sign.js';
import { Courses, CourseDetail } from './Courses.js';
import { ClassFeed, Classes, ClassDetail } from './Classes.js';
import { Members, MemberDetail } from './Members.js';
import { Charts } from './Charts.js';
import { Usage } from './Usage.js';
import { Auth } from './Auth.js';
import { Subscribe } from './PayPal.js';
import { PasswordReset, ConfirmReset } from './PasswordReset.js';
import { NotFound, PleaseLogin } from './Misc.js';
import { Debug } from './Debug.js';
import { Footer } from './Footer.js';

const APP_VERSION = 3;  // TODO: automate this

function App() {
	const [token, setToken] = useState(localStorage.getItem('token', ''));
	const [user, setUser] = useState(JSON.parse(localStorage.getItem('user', 'false')));
	const [refreshCount, refreshUser] = useReducer(x => x + 1, 0);
	const [yousure, setYousure] = useState(false);
	const history = useHistory();

	function setTokenCache(x) {
		setToken(x);
		localStorage.setItem('token', x);
	}

	function setUserCache(x) {
		setUser(x);
		localStorage.setItem('user', JSON.stringify(x));
	}

	useEffect(() => {
		requester('/user/', 'GET', token)
		.then(res => {
			setUserCache(res);
		})
		.catch(err => {
			console.log(err);
			setUserCache(null);
		});
	}, [token, refreshCount]);

	function logout() {
		if (yousure) {
			setTokenCache('');
			setUserCache(null);
			setYousure(false);
			history.push('/');
			window.scrollTo(0, 0);
		} else {
			setYousure(true);
		}
	}

	useEffect(() => {
		if (user) {
			const data = {
				id: user.member.id,
				username: user.username,
				path: history.location.pathname,
			};
			requester('/ping/', 'POST', token, data)
			.then()
			.catch(err => {
				console.log(err);
				if (err.data && err.data.detail === 'Invalid token.') {
					logout(); // You Sure?
					logout();
				}
			});
		}
	}, [history.location]);

	useEffect(() => {
		const options = {
			bottom: '16px',
			right: '16px',
			buttonColorDark: '#666',
			buttonColorLight: '#aaa',
			label: '🌙',
		}
		const darkmode = new Darkmode(options);
		darkmode.showWidget();
	}, []);

	if (user && user?.app_version !== APP_VERSION) {
		setUserCache(false);
		window.location.reload();
	}

	return (
		<div>
			<ManageScroll />

			<div className='content-wrap'>
			<div className='content-wrap-inside'>

			<Switch>
				<Route exact path='/classfeed'>
					<ClassFeed />
				</Route>

				<Route exact path='/usage/:name'>
					<Usage token={token} />
				</Route>

				<Route path='/'>
					<Container>
						<div className='hero'>
							<Link to='/'>
								<img src='/logo-long.svg' className='logo-long' />
							</Link>
						</div>

						{window.location.hostname !== 'my.protospace.ca' &&
							<p style={{ background: 'yellow' }}>~~~~~ Development site ~~~~~</p>
						}
					</Container>

					<Menu>
						<Container>
							<Menu.Item
								icon='home'
								as={Link}
								to='/'
							/>

							<Dropdown item text='Member' id='ps-menu'>
								<Dropdown.Menu>
									<Dropdown.Item
										content='Account'
										as={Link}
										to='/account'
									/>
									<Dropdown.Item
										content='Transactions'
										as={Link}
										to='/transactions'
									/>
									<Dropdown.Item
										content='Paymaster'
										as={Link}
										to='/paymaster'
									/>
									<Dropdown.Item
										content='Training'
										as={Link}
										to='/training'
									/>
									<Dropdown.Item
										content='Cards / Access'
										as={Link}
										to='/cards'
									/>
								</Dropdown.Menu>
							</Dropdown>

							<Dropdown item text='Space' id='ps-menu'>
								<Dropdown.Menu>
									<Dropdown.Item
										content='Member List'
										as={Link}
										to='/members'
									/>
									<Dropdown.Item
										content='Classes'
										as={Link}
										to='/classes'
									/>
									<Dropdown.Item
										content='Utilities'
										as={Link}
										to='/utils'
									/>
									<Dropdown.Item
										content='Charts'
										as={Link}
										to='/charts'
									/>

									{user && isAdmin(user) && <Dropdown.Item
										content='Admin'
										as={Link}
										to='/admin'
									/>}

									{user && isAdmin(user) && <Dropdown.Item
										content='Transactions'
										as={Link}
										to='/admintrans'
									/>}
								</Dropdown.Menu>
							</Dropdown>

							{user && <Menu.Menu position='right'>
								<Menu.Item
									content={yousure ? 'Log out?' : ''}
									onClick={logout}
									icon='sign out'
								/>
								<Menu.Item fitted content='' />
							</Menu.Menu>}
						</Container>
					</Menu>

					<Route exact path='/'>
						<Home token={token} setTokenCache={setTokenCache} user={user} refreshUser={refreshUser} />
					</Route>

					<div className='topPadding'>
						<Switch>
							<Route path='/debug'>
								<Debug token={token} user={user} />
							</Route>

							<Route path='/password/reset/confirm/:uid/:token'>
								<ConfirmReset />
							</Route>
							<Route path='/password/reset'>
								<PasswordReset />
							</Route>

							<Route path='/utils'>
								<Paste token={token} />
							</Route>

							<Route path='/sign'>
								<Sign token={token} />
							</Route>

							<Route path='/charts'>
								<Charts />
							</Route>

							<Route path='/auth'>
								<Auth user={user} />
							</Route>

							<Route path='/subscribe'>
								<Subscribe />
							</Route>

							<Route exact path='/classes'>
								<Classes token={token} user={user} refreshUser={refreshUser} />
							</Route>

							{user && user.member.set_details ?
								<Switch>
									<Route path='/account'>
										<Account token={token} user={user} refreshUser={refreshUser} />
									</Route>

									<Route path='/transactions/:id'>
										<TransactionDetail token={token} user={user} refreshUser={refreshUser} />
									</Route>
									<Route path='/transactions'>
										<Transactions user={user} />
									</Route>

									<Route path='/paymaster'>
										<Paymaster user={user} />
									</Route>

									<Route path='/cards'>
										<Cards token={token} user={user} />
									</Route>

									<Route path='/training'>
										<Training user={user} />
									</Route>

									<Route path='/courses/:id'>
										<CourseDetail token={token} user={user} />
									</Route>

									<Route path='/courses'>
										<Courses token={token} user={user} />
									</Route>

									<Route path='/classes/:id'>
										<ClassDetail token={token} user={user} refreshUser={refreshUser} />
									</Route>

									<Route path='/members/:id'>
										<MemberDetail token={token} user={user} />
									</Route>
									<Route path='/members'>
										<Members token={token} user={user} />
									</Route>

									{user && isAdmin(user) &&
										<Route path='/admin'>
											<Admin token={token} user={user} />
										</Route>
									}

									{user && isAdmin(user) &&
										<Route path='/admintrans'>
											<AdminTransactions token={token} user={user} />
										</Route>
									}

									<Route path='/:page'>
										<NotFound />
									</Route>
								</Switch>
							:
								<Route path='/:page'>
									<PleaseLogin />
								</Route>
							}
						</Switch>
					</div>
				</Route>
			</Switch>

			</div>
			</div>

			<Footer />
		</div>
	)
};

export default App;
