import React, { useState, useEffect, useReducer, useRef } from 'react';
import { requester, useIsMobile, useWindowSize } from './utils.js';

export function Balloon(props) {
	const [balloon, setBalloon] = useState(false);
	const [isBlurred, setIsBlurred] = useState(true);
	const [refreshCount, refreshBalloon] = useReducer(x => x + 1, 0);
	const globeContainerRef = useRef();
	const globeInstanceRef = useRef();
	const isInitialLoad = useRef(true);
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
		const Globe = window.Globe;
		if (Globe && globeContainerRef.current) {
			if (!globeInstanceRef.current) {
				const myGlobe = Globe({ animateIn: false })(globeContainerRef.current)
					.globeImageUrl('//unpkg.com/three-globe/example/img/earth-blue-marble.jpg')
					.bumpImageUrl('//unpkg.com/three-globe/example/img/earth-topology.png')
					.backgroundImageUrl('//unpkg.com/three-globe/example/img/night-sky.png')
					.pathPoints('points')
					.pathPointLat(p => p.lat)
					.pathPointLng(p => p.lng)
					.pathPointAlt(p => p.altitudeFt / 20902231) // Earth radius in feet
					.pathStroke(2)
					.pathColor(() => 'rgba(255, 100, 50, 1.0)')
					.pathTransitionDuration(0);
				globeInstanceRef.current = myGlobe;
			}
			globeInstanceRef.current.width(width).height(height);
		}
	}, [width, height]);

	useEffect(() => {
		if (globeInstanceRef.current && balloon && balloon.positions && balloon.positions.length > 0) {
			const pathData = [{ points: balloon.positions }];
			globeInstanceRef.current.pathsData(pathData);

			if (isInitialLoad.current) {
				const lastPoint = balloon.positions[0]; // data is reverse chronological

				// Instantly set camera to be looking at the last point from far away
				globeInstanceRef.current.pointOfView({ lat: lastPoint.lat, lng: lastPoint.lng, altitude: 10 });

				// Animate zoom-in
				setTimeout(() => {
					globeInstanceRef.current.pointOfView({ altitude: 2 }, 1600);
				}, 100);

				// Un-blur halfway through zoom
				setTimeout(() => {
					setIsBlurred(false);
				}, 900);

				isInitialLoad.current = false;
			}
		}
	}, [balloon]);

	console.log(balloon);

	return (
		<div
			ref={globeContainerRef}
			style={{
				position: 'fixed',
				top: 0,
				left: 0,
				width: '100vw',
				height: '100vh',
				zIndex: '3',
				filter: isBlurred ? 'blur(8px)' : 'none',
				transition: 'filter 1s ease-out',
			}}
		/>
	);
};
