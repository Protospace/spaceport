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

						<Header size='medium'>Job #{usage.last_use_id} Time</Header>

						<p className='stat'>
							{parseInt(usage.last_use_time / 60)} mins
						</p>

						<Header size='medium'>Today Total</Header>

						<p className='stat'>
							{parseInt(usage.today_total / 60)} mins
						</p>

						<Header size='medium'>Month Total</Header>

						<p className='stat'>
							{parseInt(usage.month_total / 60)} mins
						</p>
					</>
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
