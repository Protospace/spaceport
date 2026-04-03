import React, { useState, useEffect, useReducer } from 'react';
import moment from 'moment-timezone';
import * as THREE from 'three';
import { Container} from 'semantic-ui-react';
import { requester, useIsMobile } from './utils.js';

export function Balloon(props) {
	const [balloon, setBalloon] = useState(false);
	const [refreshCount, refreshBalloon] = useReducer(x => x + 1, 0);
	const mountRef = useRef(null);

	const getBalloon = () => {
		requester('/stats/balloon_data/', 'GET')
		.then(res => {
			setBalloon(res);
		})
		.catch(err => {
			console.log(err);
			setBalloon(false);
		});
	};

	useEffect(() => {
		getBalloon();
		const interval = setInterval(getBalloon, 60000);
		return () => clearInterval(interval);
	}, []);

	useEffect(() => {
		getBalloon();
	}, [refreshCount]);

	console.log(balloon);

	return (
		<>
			<div ref={mountRef} style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%' }} />
		</>
	);
};
