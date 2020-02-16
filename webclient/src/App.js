import React, { useState, useEffect, useReducer, useContext } from 'react';
import { BrowserRouter as Router, Switch, Route, Link, useParams, useHistory } from 'react-router-dom';
import './semantic-ui/semantic.min.css';
import './light.css';
import { Container, Divider, Dropdown, Form, Grid, Header, Icon, Image, Menu, Message, Segment, Table } from 'semantic-ui-react';
import { isAdmin, requester } from './utils.js';
import { Home } from './Home.js';
import { Account } from './Account.js';
import { Transactions, TransactionDetail } from './Transactions.js';
import { Cards } from './Cards.js';
import { Training } from './Training.js';
import { AdminReportedTransactions } from './AdminTransactions.js';
import { Admin } from './Admin.js';
import { Courses, CourseDetail } from './Courses.js';
import { Classes, ClassDetail } from './Classes.js';
import { Members, MemberDetail } from './Members.js';
import { NotFound, PleaseLogin } from './Misc.js';
import { Footer } from './Footer.js';

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
		user && requester('/ping/', 'POST', token, {})
		.then()
		.catch(err => {
			console.log(err);
			if (err.data && err.data.detail === 'Invalid token.') {
				logout(); // You Sure?
				logout();
			}
		});
	}, [history.location]);

	return (
		<div>
			<div className='content-wrap'>
			<div className='content-wrap-inside'>

			<Container>
				<div className='hero'>
					<Link to='/'>
						<img src='/logo-long.svg' className='logo-long' />
					</Link>
				</div>
			</Container>

			<Menu>
				<Container>
					<Menu.Item
						content='Home'
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
								content='Training'
								as={Link}
								to='/training'
							/>
							<Dropdown.Item
								content='Cards'
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
								content='Courses'
								as={Link}
								to='/courses'
							/>
							<Dropdown.Item
								content='Classes'
								as={Link}
								to='/classes'
							/>

							{user && isAdmin(user) && <Dropdown.Item
								content='Admin'
								as={Link}
								to='/admin'
							/>}

							{user && isAdmin(user) && <Dropdown.Item
								content='Admin Trans.'
								as={Link}
								to='/admintrans'
							/>}
						</Dropdown.Menu>
					</Dropdown>

					{user && <Menu.Menu position='right'>
						<Menu.Item
							content={yousure ? 'You Sure?' : 'Log Out'}
							onClick={logout}
							icon='cancel'
						/>
						<Menu.Item fitted content='' />
					</Menu.Menu>}
				</Container>
			</Menu>

			<Route exact path='/'>
				<Home token={token} setTokenCache={setTokenCache} user={user} refreshUser={refreshUser} />
			</Route>

			<div className='topPadding'>
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

						<Route path='/cards'>
							<Cards user={user} />
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
						<Route path='/classes'>
							<Classes token={token} />
						</Route>

						<Route path='/members/:id'>
							<MemberDetail token={token} user={user} />
						</Route>
						<Route path='/members'>
							<Members token={token} />
						</Route>

						{user && isAdmin(user) &&
							<Route path='/admin'>
								<Admin token={token} user={user} />
							</Route>
						}

						{user && isAdmin(user) &&
							<Route path='/admintrans'>
								<AdminReportedTransactions token={token} user={user} />
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
			</div>

			</div>
			</div>

			<Footer />
		</div>
	)
};

export default App;
