import React, { useState, useEffect, useReducer, useRef } from 'react';
import { requester, useIsMobile, useWindowSize } from './utils.js';

export function Balloon(props) {
	const [balloon, setBalloon] = useState(false);
	const [refreshCount, refreshBalloon] = useReducer(x => x + 1, 0);
	const globeContainerRef = useRef();
	const globeInstanceRef = useRef();
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
				const myGlobe = Globe()(globeContainerRef.current)
					.globeImageUrl('//unpkg.com/three-globe/example/img/earth-blue-marble.jpg')
					.bumpImageUrl('//unpkg.com/three-globe/example/img/earth-topology.png')
					.backgroundImageUrl('//unpkg.com/three-globe/example/img/night-sky.png')
					.pathPoints('points')
					.pathPointLat(p => p.lat)
					.pathPointLng(p => p.lng)
					.pathPointAlt(p => p.altitudeFt / 200000)
					.pathStroke(1.5)
					.pathColor(() => 'rgba(255, 100, 50, 0.6)')
					.pathTransitionDuration(0);
				globeInstanceRef.current = myGlobe;
			}
			globeInstanceRef.current.width(width).height(height);
		}
	}, [width, height]);

	useEffect(() => {
		if (globeInstanceRef.current && balloon && balloon.length > 0) {
			const pathData = [{ points: balloon }];
			globeInstanceRef.current.pathsData(pathData);

			const lastPoint = balloon[0]; // data is reverse chronological
			globeInstanceRef.current.pointOfView({ lat: lastPoint.lat, lng: lastPoint.lng, altitude: 2 }, 1600);
		}
	}, [balloon]);

	console.log(balloon);

	return (
		<div ref={globeContainerRef} style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', zIndex: '3' }} />
	);
};
