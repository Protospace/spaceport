import React, { useRef, useState, useEffect, useReducer } from 'react';
import { BrowserRouter as Router, Switch, Route, Link, useParams, useLocation } from 'react-router-dom';
import moment from 'moment-timezone';
import QRCode from 'react-qr-code';
import { Button, Container, Divider, Dropdown, Form, Grid, Header, Icon, Image, Menu, Message, Popup, Segment, Table } from 'semantic-ui-react';
import { statusColor, BasicTable, siteUrl, staticUrl, requester, isAdmin } from './utils.js';

const deviceNames = {
	'trotec': {title: 'Trotec', device: 'TROTECS300'},
};

export function Usage(props) {
	const { name } = useParams();
	const title = deviceNames[name].title;
	const device = deviceNames[name].device;
	const [usage, setUsage] = useState(false);
	const [fullElement, setFullElement] = useState(false);
	const ref = useRef(null);

	const getUsage = () => {
		requester('/stats/usage_data/?device='+device, 'GET', '')
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

	const goFullScreen = () => {
		if ('wakeLock' in navigator) {
			navigator.wakeLock.request('screen');
		}

		ref.current.requestFullscreen({ navigationUI: 'hide' }).then(() => {
			setFullElement(true);
		});
	};

	const inUse = usage && moment().unix() - usage.track.time <= 60;
	const showUsage = usage && inUse && usage.track.username === usage.username;

	const now = moment();

	return (
		<Container>
			<div className='usage' ref={ref}>

				{!fullElement &&
					<p>
						<Button onClick={goFullScreen}>Fullscreen</Button>
					</p>
				}

				{showUsage ?
					<TrotecUsage usage={usage} />
				:
					<>
						<Header size='large'>{title} Usage</Header>
						<p/>
						<p>Waiting for job</p>
					</>
				}

			</div>
		</Container>
	);
};

export function TrotecUsage(props) {
	const { usage } = props;

	const today_total = parseInt(usage.today_total / 60);
	const month_total = parseInt(usage.month_total / 60);
	const free_time = 360;

	return (
		<>
			<p className='stat'>
				{usage.first_name}
			</p>

			<div style={{ backgroundColor: usage.session_time > 10800 ? '#cc0000' : '' }}>
				<Header size='medium'>Session Time</Header>

				<p className='stat'>
					{parseInt(usage.session_time / 60)} mins
				</p>
			</div>

			<Header size='medium'>Laser-firing Time Today</Header>

			<p className='stat'>
				{today_total} mins
			</p>

			<Header size='medium'>Laser-firing Time Month</Header>

			<p className='stat'>
				{month_total} mins
			</p>

			{month_total <= free_time ?
				<>
					<Header size='medium'>Free Time Remaining</Header>

					<p className='stat'>
						{free_time - month_total} mins
					</p>
				</>
			:
				<>
					<Header size='medium'>Current Month Bill</Header>

					<p className='stat'>
						${((month_total - free_time) * 0.5).toFixed(2)}
					</p>
				</>
			}
		</>
	);
}
