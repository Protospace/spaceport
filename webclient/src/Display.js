import React, { useRef, useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import moment from 'moment-timezone';
import { Button, Container, Header } from 'semantic-ui-react';
import { requester } from './utils.js';
import { TrotecUsage } from './Usage.js';

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

				<div className='display-scores'>
					<DisplayScores />
				</div>

				<div className='display-usage'>
					<DisplayUsage token={token} name={'trotec'} />
				</div>
			</div>
		</Container>
	);
};

export function DisplayUsage(props) {
	const { token, name } = props;
	const title = deviceNames[name].title;
	const device = deviceNames[name].device;
	const [usage, setUsage] = useState(false);

	const getUsage = () => {
		requester('/stats/usage_data/?device='+device, 'GET', token)
		.then(res => {
			setUsage(res);
		})
		.catch(err => {
			console.log(err);
			setUsage(false);
		});
	};

	useEffect(() => {
		getUsage();
		const interval = setInterval(getUsage, 60000);
		return () => clearInterval(interval);
	}, []);

	const inUse = usage && moment().unix() - usage.track.time <= 60;
	const showUsage = usage && inUse && usage.track.username === usage.username;

	return (
		<>
			<Header size='large'>Trotec Usage</Header>

			{showUsage ?
				<TrotecUsage usage={usage} />
			:
				<p className='stat'>
					Waiting for job
				</p>
			}
		</>
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

			{scores && scores.map((x, i) =>
				<div key={i}>
					<Header size='medium'>#{i+1} — {x.name}. {i === 0 ? '👑' : ''}</Header>
					<p>{x.score.toLocaleString()}</p>
				</div>
			)}

		</>
	);
};
