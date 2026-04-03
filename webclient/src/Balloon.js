import React, { useState, useEffect, useReducer, useRef } from 'react';
import moment from 'moment-timezone';
import { requester, useIsMobile, useWindowSize } from './utils.js';

export function Balloon(props) {
	const [balloon, setBalloon] = useState(false);
	const [isBlurred, setIsBlurred] = useState(true);
	const [refreshCount, refreshBalloon] = useReducer(x => x + 1, 0);
	const globeContainerRef = useRef();
	const globeInstanceRef = useRef();
	const isInitialLoad = useRef(true);
	const titleRef = useRef();
	const aboutButtonRef = useRef();
	const faqButtonRef = useRef();
	const lastSeenRef = useRef();
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

				// Un-blur during first half of zoom
				setTimeout(() => {
					setIsBlurred(false);
				}, 100);

				isInitialLoad.current = false;
			}
		}
	}, [balloon]);

	useEffect(() => {
		if (titleRef.current) titleRef.current.style.setProperty('font-family', 'monospace', 'important');
		if (aboutButtonRef.current) aboutButtonRef.current.style.setProperty('font-family', 'monospace', 'important');
		if (faqButtonRef.current) faqButtonRef.current.style.setProperty('font-family', 'monospace', 'important');
		if (lastSeenRef.current) lastSeenRef.current.style.setProperty('font-family', 'monospace', 'important');
	}, []);

	console.log(balloon);

	const uiContainerStyle = {
		position: 'fixed',
		top: '20px',
		left: '20px',
		zIndex: '4',
		display: 'flex',
		alignItems: 'center',
	};

	const titleStyle = {
		color: 'white',
		border: '1px solid white',
		padding: '10px 15px',
		fontSize: '1.2em',
		fontWeight: 'bold',
	};

	const buttonStyle = {
		backgroundColor: 'white',
		color: 'black',
		border: '1px solid white',
		padding: '10px 15px',
		fontSize: '1.2em',
		cursor: 'pointer',
		marginLeft: '-1px',
	};

	const statsContainerStyle = {
		position: 'fixed',
		top: '80px',
		left: '20px',
		zIndex: '4',
		display: 'flex',
	};

	const statBoxStyle = {
		border: '1px solid white',
		padding: '5px 10px',
		color: 'white',
		textAlign: 'center',
	};

	const statLabelStyle = {
		fontSize: '0.7em',
		opacity: 0.7,
	};

	const statValueStyle = {
		fontSize: '1em',
	};

	const lastSeenTime = balloon && balloon.positions && balloon.positions.length > 0
		? moment.utc(balloon.positions[0].time).local().format()
		: '...';

	return (
		<>
			<div style={uiContainerStyle}>
				<div style={titleStyle} ref={titleRef}>Protoballoon</div>
				<button style={buttonStyle} ref={aboutButtonRef}>About</button>
				<button style={buttonStyle} ref={faqButtonRef}>FAQ</button>
			</div>
			<div style={statsContainerStyle}>
				<div style={statBoxStyle} ref={lastSeenRef}>
					<div style={statLabelStyle}>LAST SEEN</div>
					<div style={statValueStyle}>{lastSeenTime}</div>
				</div>
			</div>
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
					transition: 'filter 0.8s ease-out',
				}}
			/>
		</>
	);
};
