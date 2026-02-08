import React, { useRef, useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import moment from 'moment-timezone';
import { Button, Container, Header, Icon } from 'semantic-ui-react';
import { requester } from './utils.js';
import QRCode from 'react-qr-code';

const deviceNames = {
	'trotec': {title: 'Trotec', device: 'TROTECS300'},
};

export function LCARS1Display(props) {
	const { token } = props;
	const [fullElement, setFullElement] = useState(false);
	const ref = useRef(null);

	const goFullScreen = () => {
		if ('wakeLock' in navigator) {
			navigator.wakeLock.request('screen');
		}

		ref.current.requestFullscreen({ navigationUI: 'hide' }).then(() => {
			setFullElement(true);
		});
	};

	return (
		<Container>
			<div className='display' ref={ref}>

				{!fullElement &&
					<p>
						<Button onClick={goFullScreen}>Fullscreen</Button>
					</p>
				}

				<div className='display-tasks'>
					<DisplayShoppingList />
					<DisplayMaintenanceList />
				</div>

				<div className='display-scores'>
					<DisplayScores />
				</div>

				<div className='display-scores'>
					<DisplayHosting />
				</div>

				<div className='display-scores'>
					<DisplayMonthlyHosting />
				</div>
			</div>
		</Container>
	);
};

export function LCARS2Display(props) {
	const { token } = props;
	const [fullElement, setFullElement] = useState(false);
	const ref = useRef(null);

	const goFullScreen = () => {
		if ('wakeLock' in navigator) {
			navigator.wakeLock.request('screen');
		}

		ref.current.requestFullscreen({ navigationUI: 'hide' }).then(() => {
			setFullElement(true);
		});
	};

	return (
		<Container>
			<div className='display' ref={ref}>

				{!fullElement &&
					<p>
						<Button onClick={goFullScreen}>Fullscreen</Button>
					</p>
				}

				<div className='display-tasks'>
					<DisplayShoppingList />
				</div>

				<div className='display-scores'>
					<DisplayMonthlyHosting />
				</div>

				<div className='display-shelves'>
					<DisplayAvailableShelves />
				</div>

				<div className='display-scores'>
					<DisplaySignups />
				</div>
			</div>
		</Container>
	);
};

export function LCARS3Display(props) {
	const { token } = props;
	const [fullElement, setFullElement] = useState(false);
	const ref = useRef(null);

	const goFullScreen = () => {
		if ('wakeLock' in navigator) {
			navigator.wakeLock.request('screen');
		}

		ref.current.requestFullscreen({ navigationUI: 'hide' }).then(() => {
			setFullElement(true);
		});
	};

	return (
		<Container>
			<div className='display' ref={ref}>

				{!fullElement &&
					<p>
						<Button onClick={goFullScreen}>Fullscreen</Button>
					</p>
				}

				<div className='display-printers'>
					<DisplayBambuCamera name={'p1s1'} />
					<DisplayBambuCamera name={'p1s2'} />
				</div>

				<div className='display-classes'>
					<DisplayClasses />
				</div>
			</div>
		</Container>
	);
};

export function DisplayScores(props) {
	const { token, name } = props;
	const [scores, setScores] = useState(false);

	const getScores = () => {
		requester('/pinball/high_scores/', 'GET')
		.then(res => {
			setScores(res);
		})
		.catch(err => {
			console.log(err);
			setScores(false);
		});
	};

	useEffect(() => {
		getScores();
		const interval = setInterval(getScores, 60000);
		return () => clearInterval(interval);
	}, []);

	return (
		<>
			<Header size='large'>Pinball High Scores</Header>

			{scores && scores.slice(0, 5).map((x, i) =>
				<div key={i}>
					<Header size='medium'>#{i+1} — {x.name}. {i === 0 ? '👑' : ''}</Header>
					<p>{x.score.toLocaleString()}</p>
				</div>
			)}

		</>
	);
};

export function DisplayMonthlyScores(props) {
	const { token, name } = props;
	const [scores, setScores] = useState(false);

	const getScores = () => {
		requester('/pinball/monthly_high_scores/', 'GET')
		.then(res => {
			setScores(res);
		})
		.catch(err => {
			console.log(err);
			setScores(false);
		});
	};

	useEffect(() => {
		getScores();
		const interval = setInterval(getScores, 60000);
		return () => clearInterval(interval);
	}, []);

	return (
		<>
			<Header size='large'>Monthly High Scores</Header>

			{scores && scores.slice(0, 5).map((x, i) =>
				<div key={i}>
					<Header size='medium'>#{i+1} — {x.name}. {i === 0 ? '🧙' : ''}</Header>
					<p>{x.score.toLocaleString()}</p>
				</div>
			)}

		</>
	);
};

export function DisplayHosting(props) {
	const { token, name } = props;
	const [scores, setScores] = useState(false);

	const getScores = () => {
		requester('/hosting/high_scores/', 'GET')
		.then(res => {
			setScores(res);
		})
		.catch(err => {
			console.log(err);
			setScores(false);
		});
	};

	useEffect(() => {
		getScores();
		const interval = setInterval(getScores, 60000);
		return () => clearInterval(interval);
	}, []);

	return (
		<>
			<Header size='large'>Most Host</Header>

			{scores && scores.slice(0, 5).map((x, i) =>
				<div key={i}>
					<Header size='medium'>#{i+1} — {x.name}. {i === 0 ? <img className='toast' src='/toast.png' /> : ''}</Header>
					<p>{x.hours.toFixed(2)} hours</p>
				</div>
			)}

		</>
	);
};

export function DisplayMonthlyHosting(props) {
	const { token, name } = props;
	const [scores, setScores] = useState(false);

	const getScores = () => {
		requester('/hosting/monthly_high_scores/', 'GET')
		.then(res => {
			setScores(res);
		})
		.catch(err => {
			console.log(err);
			setScores(false);
		});
	};

	useEffect(() => {
		getScores();
		const interval = setInterval(getScores, 60000);
		return () => clearInterval(interval);
	}, []);

	return (
		<>
			<Header size='large'>Monthly Most Host</Header>

			{scores && scores.slice(0, 5).map((x, i) =>
				<div key={i}>
					<Header size='medium'>#{i+1} — {x.name}. {i === 0 ? '🚀' : ''}</Header>
					<p>{x.hours.toFixed(2)} hours</p>
				</div>
			)}

		</>
	);
};

export function DisplaySignups(props) {
	const { token, name } = props;
	const [scores, setScores] = useState(false);

	const getScores = () => {
		requester('/signuphelper/high_scores/', 'GET')
		.then(res => {
			setScores(res);
		})
		.catch(err => {
			console.log(err);
			setScores(false);
		});
	};

	useEffect(() => {
		getScores();
		const interval = setInterval(getScores, 60000);
		return () => clearInterval(interval);
	}, []);

	return (
		<>
			<Header size='large'>Most 🟢 Signups</Header>

			{scores && scores.slice(0, 5).map((x, i) =>
				<div key={i}>
					<Header size='medium'>#{i+1} — {x.name}. {i === 0 ? '📝' : ''}</Header>
					<p>{x.signups} signups</p>
				</div>
			)}

		</>
	);
};

export function DisplayAvailableShelves(props) {
	const { token, name } = props;
	const [shelves, setShelves] = useState(false);

	const getShelves = () => {
		requester('/storage/available/', 'GET')
		.then(res => {
			setShelves(res);
		})
		.catch(err => {
			console.log(err);
			setShelves(false);
		});
	};

	useEffect(() => {
		getShelves();
		const interval = setInterval(getShelves, 60000);
		return () => clearInterval(interval);
	}, []);

	return (
		<>
			<Header size='large'>Available Shelves</Header>

			{shelves && shelves.slice(0, 10).map((x, i) =>
				<div key={i} className={x.member_paused ? 'shelf expired' : 'shelf'}>
					<Header size='large'>{x.shelf_id}</Header>
				</div>
			)}
		</>
	);
};

export function DisplayClasses(props) {
	const [classes, setClasses] = useState(false);

	useEffect(() => {
		const get = async() => {
			requester('/sessions/', 'GET', '')
			.then(res => {
				setClasses(res.results);
			})
			.catch(err => {
				console.log(err);
			});
		};

		get();
		const interval = setInterval(get, 60000);
		return () => clearInterval(interval);
	}, []);

	const now = new Date().toISOString();

	const isTodayOrFuture = (x) => moment.utc(x.datetime).tz('America/Edmonton') > moment().tz('America/Edmonton').startOf('day');
	const isToday = (x) => moment().tz('America/Edmonton').isSame(moment.utc(x.datetime).tz('America/Edmonton'), 'day');

	return (
		<>
			<Header size='large'>Upcoming Classes / Events</Header>

			{classes ? classes.filter(isTodayOrFuture).filter(x => !x.is_cancelled).sort((a, b) => a.datetime > b.datetime ? 1 : -1).slice(0, 5).map((x, i) =>
				<div key={i} className={isToday(x) ? 'today' : ''}>
					<Header size='medium'>{x.course_data.name}</Header>
					<p>
						{isToday(x) ?
							'Today' + moment.utc(x.datetime).tz('America/Edmonton').format(' @ LT')
						:
							moment.utc(x.datetime).tz('America/Edmonton').format('ddd, ll @ LT')
						}

					</p>
				</div>
			)
			:
				<p>Loading...</p>
			}
		</>
	);
};

export function DisplayBambuCamera(props) {
	const { token, name } = props;
	const [pic, setPic] = useState(false);

	const getPic = () => {
		requester('http://localhost/' + name + '/pic.jpg', 'GET')
		.then(res => res.blob())
		.then(imageBlob => {
			const imageObjectURL = URL.createObjectURL(imageBlob);
			setPic(oldPic => {
				URL.revokeObjectURL(oldPic);
				return imageObjectURL;
			});
		})
		.catch(err => {
			console.log(err);
			setPic(false);
		});
	};

	useEffect(() => {
		getPic();
		const interval = setInterval(getPic, 1000);
		return () => clearInterval(interval);
	}, []);

	return (
		<>
			{pic && <img className='printer-pic' src={pic} />}
		</>
	);
};

export function DisplayShoppingList(props) {
	const [tasks, setTasks] = useState(false);

	const getTasks = () => {
		requester('/todo/tasks/?project=Consumables', 'GET')
		.then(res => {
			setTasks(res);
		})
		.catch(err => {
			console.log(err);
			setTasks(false);
		});
	};

	useEffect(() => {
		getTasks();
		const interval = setInterval(getTasks, 10000);
		return () => clearInterval(interval);
	}, []);

	return (
		<div className='task-list'>
			<Header size='large'>Consumables</Header>

			<div className='qr'>
				<QRCode size={128} value={'https://todo.protospace.ca/projects/4'} />
			</div>

			<Header size='medium'>Shopping list:</Header>

			{tasks && tasks.slice(0, 10).map((x, i) => {
				const isOrdered = x.labels?.some(label => label.title === 'Ordered');
				const text = isOrdered ? <s style={{ textDecorationThickness: '0.15em' }}>{x.title}</s> : x.title;
				return (
					<div key={i}>
						<Header size='medium'>#{i+1} — {text}</Header>
					</div>
				);
			})}

		</div>
	);
};

export function DisplayMaintenanceList(props) {
	const [tasks, setTasks] = useState(false);

	const getTasks = () => {
		requester('/todo/tasks/?project=Maintenance', 'GET')
		.then(res => {
			setTasks(res);
		})
		.catch(err => {
			console.log(err);
			setTasks(false);
		});
	};

	useEffect(() => {
		getTasks();
		const interval = setInterval(getTasks, 10000);
		return () => clearInterval(interval);
	}, []);

	return (
		<div className='task-list'>
			<Header size='large'>Tasks</Header>

			<div className='qr'>
				<QRCode size={128} value={'https://todo.protospace.ca/projects/76'} />
			</div>

			<Header size='medium'>Maintenance list:</Header>

			{tasks && tasks.slice(0, 10).map((x, i) => {
				const isCompleted = x.labels?.some(label => label.title === 'Completed');
				const text = isCompleted ? <s style={{ textDecorationThickness: '0.15em' }}>{x.title}</s> : x.title;
				return (
					<div key={i}>
						<Header size='medium'>#{i+1} — {text}</Header>
					</div>
				);
			})}

		</div>
	);
};
