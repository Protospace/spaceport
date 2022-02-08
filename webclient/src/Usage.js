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

	const inUse = usage && moment().unix() - usage.track.time < 300;
	const showUsage = usage && inUse && usage.track.username === usage.session.username;

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
						<Header size='medium'>Hello,</Header>

						<p className='stat'>
							{usage.session.first_name}
						</p>

						<Header size='medium'>Session Time</Header>

						<p className='stat'>
							{parseInt(moment.duration(moment(now).diff(usage.session.start_time)).asMinutes())} mins
						</p>

						<Header size='medium'>Laser Time</Header>

						<p className='stat'>
							{parseInt(usage.session.num_seconds / 60)} mins
						</p>
					</>
				:
					<>
						<Header size='large'>{title} Usage</Header>
						<p>Waiting for session</p>
					</>
				}

			</div>
		</Container>
	);
};
