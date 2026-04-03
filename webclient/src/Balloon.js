import React, { useState, useEffect, useReducer, useRef } from 'react';
import { requester, useIsMobile, useWindowSize } from './utils.js';

export function Balloon(props) {
	const [balloon, setBalloon] = useState(false);
	const [refreshCount, refreshBalloon] = useReducer(x => x + 1, 0);
	const globeEl = useRef();
	const { width, height } = useWindowSize();

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

	useEffect(() => {
		if (globeEl.current && balloon && balloon.length > 0) {
			const lastPoint = balloon[0]; // data is reverse chronological
			globeEl.current.pointOfView({ lat: lastPoint.lat, lng: lastPoint.lng, altitude: 2 }, 1600);
		}
	}, [balloon]);

	console.log(balloon);

	const pathData = balloon ? [{
		points: balloon,
	}] : [];

	const ReactGlobe = window.ReactGlobe;
	if (!ReactGlobe) {
		console.log('no react globe');
		return null;
	}

	return (
		<ReactGlobe
			ref={globeEl}
			width={width}
			height={height}
			globeImageUrl="//unpkg.com/three-globe/example/img/earth-dark.jpg"
			bumpImageUrl="//unpkg.com/three-globe/example/img/earth-topology.png"
			backgroundImageUrl="//unpkg.com/three-globe/example/img/night-sky.png"
			pathsData={pathData}
			pathPoints="points"
			pathPointLat={p => p.lat}
			pathPointLng={p => p.lng}
			pathPointAlt={p => p.altitudeFt / 200000}
			pathStroke={1.5}
			pathColor={() => 'rgba(255, 100, 50, 0.6)'}
			pathTransitionDuration={0}
		/>
	);
};
