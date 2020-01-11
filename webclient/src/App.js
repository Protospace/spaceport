import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Switch, Route, Link, useParams } from 'react-router-dom';
import './light.css';
import { Container, Divider, Dropdown, Form, Grid, Header, Icon, Image, Menu, Message, Segment, Table } from 'semantic-ui-react';
import { requester } from './utils.js';
import { Home } from './Home.js';
import { Transactions, TransactionDetail } from './Transactions.js';
import { Cards } from './Cards.js';
import { Training } from './Training.js';
import { Courses, CourseDetail } from './Courses.js';
import { Classes, ClassDetail } from './Classes.js';
import { Members } from './Members.js';
import { NotFound, PleaseLogin } from './Misc.js';
import { Footer } from './Footer.js';

function App() {
	const [token, setToken] = useState(localStorage.getItem('token', ''));
	const [user, setUser] = useState(JSON.parse(localStorage.getItem('user', 'false')));

	function setTokenCache(x) {
		setToken(x);
		localStorage.setItem('token', x);
	}

	function setUserCache(x) {
		setUser(x);
		localStorage.setItem('user', JSON.stringify(x));
	}

	useEffect(() => {
		requester('/me/', 'GET', token)
		.then(res => {
			console.log(res);
			setUserCache(res);
		})
		.catch(err => {
			console.log(err);
			setUser(false);
		});
	}, [token]);

	function logout() {
		window.location = '/';
		setTokenCache('');
		setUserCache(false);
	}

	return (
		<Router>
			<div className='content-wrap'>
			<div className='content-wrap-inside'>
			<Container>
				<div className='header'>
					<img src='/logo-long.svg' className='logo-long' />
				</div>
			</Container>

			<Menu>
				<Container>
					<Menu.Item
						content='Home'
						as={Link}
						to='/'
					/>

					<Dropdown item text='Profile' id='ps-menu'>
						<Dropdown.Menu>
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
								content='Members'
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
						</Dropdown.Menu>
					</Dropdown>

					{user && <Menu.Menu position='right'>
						<Menu.Item
							content='Logout'
							onClick={logout}
							icon='cancel'
						/>
						<Menu.Item fitted content='' />
					</Menu.Menu>}
				</Container>
			</Menu>

			<Route exact path='/'>
				<Home token={token} setTokenCache={setTokenCache} user={user} setUserCache={setUserCache} />
			</Route>

			<div className='topPadding'>
				{user ?
					<Switch>
						<Route path='/transactions/:id'>
							<TransactionDetail user={user} />
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
							<CourseDetail token={token} />
						</Route>
						<Route path='/courses'>
							<Courses token={token} />
						</Route>

						<Route path='/classes/:id'>
							<ClassDetail token={token} />
						</Route>
						<Route path='/classes'>
							<Classes token={token} />
						</Route>

						<Route path='/members'>
							<Members token={token} />
						</Route>

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
		</Router>
	)
};

export default App;
