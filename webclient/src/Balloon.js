import React, { useState, useEffect, useReducer, useRef } from 'react';
import moment from 'moment-timezone';
import { requester, useIsMobile, useWindowSize } from './utils.js';

export function Balloon(props) {
	const [balloon, setBalloon] = useState(false);
	const [timeAgo, setTimeAgo] = useState('...');
	const [missionDuration, setMissionDuration] = useState('...');
	const [isBlurred, setIsBlurred] = useState(true);
	const [uiVisibility, setUiVisibility] = useState({});
	const [refreshCount, refreshBalloon] = useReducer(x => x + 1, 0);
	const globeContainerRef = useRef();
	const globeInstanceRef = useRef();
	const isInitialLoad = useRef(true);
	const titleRef = useRef();
	const aboutButtonRef = useRef();
	const faqButtonRef = useRef();
	const lastSeenRef = useRef();
	const missionDurationRef = useRef();
	const lastPositionRef = useRef();
	const altitudeRef = useRef();
	const callsignRef = useRef();
	const bandRef = useRef();
	const channelRef = useRef();
	const lapCountRef = useRef();
	const distanceRef = useRef();
	const spotsRef = useRef();
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
		const globe = globeInstanceRef.current;
		const THREE = window.THREE;

		if (!globe || !THREE) return;

		const camera = globe.camera();
		const globeMesh = globe.scene().getObjectByName('globe');
		if (!globeMesh) return;

		const raycaster = new THREE.Raycaster();
		const ndc = new THREE.Vector2();

		const refsToCheck = {
			title: titleRef,
			about: aboutButtonRef,
			faq: faqButtonRef,
			lastSeen: lastSeenRef,
			missionDuration: missionDurationRef,
			lastPosition: lastPositionRef,
			altitude: altitudeRef,
			callsign: callsignRef,
			band: bandRef,
			channel: channelRef,
			lapCount: lapCountRef,
			distance: distanceRef,
			spots: spotsRef,
		};

		const checkVisibility = () => {
			const newVisibility = {};
			for (const [name, ref] of Object.entries(refsToCheck)) {
				if (ref.current) {
					const rect = ref.current.getBoundingClientRect();
					const x = rect.left + rect.width / 2;
					const y = rect.top + rect.height / 2;

					ndc.x = (x / window.innerWidth) * 2 - 1;
					ndc.y = -(y / window.innerHeight) * 2 + 1;

					raycaster.setFromCamera(ndc, camera);
					const intersects = raycaster.intersectObject(globeMesh, true);
					newVisibility[name] = intersects.length > 0;
				}
			}
			console.log('uiVisibility', newVisibility);
			setUiVisibility(newVisibility);
		};

		const interval = setInterval(checkVisibility, 200);
		return () => clearInterval(interval);
	}, [width, height, balloon]);

	useEffect(() => {
		if (titleRef.current) titleRef.current.style.setProperty('font-family', 'monospace', 'important');
		if (aboutButtonRef.current) aboutButtonRef.current.style.setProperty('font-family', 'monospace', 'important');
		if (faqButtonRef.current) faqButtonRef.current.style.setProperty('font-family', 'monospace', 'important');
		if (lastSeenRef.current) lastSeenRef.current.style.setProperty('font-family', 'monospace', 'important');
		if (missionDurationRef.current) missionDurationRef.current.style.setProperty('font-family', 'monospace', 'important');
		if (lastPositionRef.current) lastPositionRef.current.style.setProperty('font-family', 'monospace', 'important');
		if (altitudeRef.current) altitudeRef.current.style.setProperty('font-family', 'monospace', 'important');
		if (callsignRef.current) callsignRef.current.style.setProperty('font-family', 'monospace', 'important');
		if (bandRef.current) bandRef.current.style.setProperty('font-family', 'monospace', 'important');
		if (channelRef.current) channelRef.current.style.setProperty('font-family', 'monospace', 'important');
		if (lapCountRef.current) lapCountRef.current.style.setProperty('font-family', 'monospace', 'important');
		if (distanceRef.current) distanceRef.current.style.setProperty('font-family', 'monospace', 'important');
		if (spotsRef.current) spotsRef.current.style.setProperty('font-family', 'monospace', 'important');
	}, []);

	useEffect(() => {
		if (!balloon || !balloon.positions || balloon.positions.length === 0) {
			return;
		}
		const lastPositionTime = moment.utc(balloon.positions[0].time);
		const timer = setInterval(() => {
			const now = moment();
			const duration = moment.duration(now.diff(lastPositionTime));
			const hours = String(Math.floor(duration.asHours())).padStart(2, '0');
			const minutes = String(duration.minutes()).padStart(2, '0');
			const secondsWithDecimal = (duration.seconds() + duration.milliseconds() / 1000).toFixed(1);
			const paddedSeconds = secondsWithDecimal.padStart(4, '0');
			setTimeAgo(`${hours}h ${minutes}m ${paddedSeconds}s ago`);
		}, 100);
		return () => clearInterval(timer);
	}, [balloon]);

	useEffect(() => {
		if (!balloon || !balloon.stats || !balloon.stats.timeStart) {
			return;
		}
		const startTime = moment.utc(balloon.stats.timeStart);
		const timer = setInterval(() => {
			const now = moment();
			const duration = moment.duration(now.diff(startTime));
			const days = Math.floor(duration.asDays());
			const hours = String(duration.hours()).padStart(2, '0');
			const minutes = String(duration.minutes()).padStart(2, '0');
			const secondsWithDecimal = (duration.seconds() + duration.milliseconds() / 1000).toFixed(1);
			const paddedSeconds = secondsWithDecimal.padStart(4, '0');
			setMissionDuration(`L+${days}d ${hours}:${minutes}:${paddedSeconds}`);
		}, 100);
		return () => clearInterval(timer);
	}, [balloon]);

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
		top: '64px',
		left: '20px',
		zIndex: '4',
		display: 'flex',
		flexDirection: 'column',
		alignItems: 'flex-start',
	};

	const statBoxStyle = {
		border: '1px solid white',
		padding: '5px 10px',
		color: 'white',
		textAlign: 'left',
		whiteSpace: 'nowrap',
		margin: '-1px 0 0 -1px',
	};

	const statRowStyle = {
		display: 'flex',
		flexWrap: 'wrap',
		padding: '1px 0 0 1px',
	};

	const statLabelStyle = {
		fontSize: '0.7em',
	};

	const statValueStyle = {
		fontSize: '1em',
	};

	const timeAgoStyle = {
		fontSize: '1em',
	};

	const lastSeenTime = balloon && balloon.positions && balloon.positions.length > 0
		? moment.utc(balloon.positions[0].time).tz(moment.tz.guess()).format('YYYY-MM-DD HH:mm:ss z')
		: '...';

	const sinceDate = balloon && balloon.stats && balloon.stats.timeStart
		? `since ${balloon.stats.timeStart.substring(0, 10)}`
		: '';

	const lastPosition = balloon && balloon.positions && balloon.positions.length > 0
		? `${balloon.positions[0].lat}, ${balloon.positions[0].lng}`
		: '...';

	const altitude = balloon && balloon.positions && balloon.positions.length > 0
		? `${balloon.positions[0].altitudeFt.toLocaleString()} ft`
		: '...';

	const lapCount = balloon && balloon.stats ? balloon.stats.lapCount : '...';
	const distanceTraveled = balloon && balloon.stats ? `${balloon.stats.distanceTraveledKm.toLocaleString()} km` : '...';
	const spots = balloon && balloon.stats ? balloon.stats.spots.toLocaleString() : '...';
	const callsign = balloon && balloon.stats ? balloon.stats.callsign : '...';
	const band = balloon && balloon.stats ? balloon.stats.band : '...';
	const channel = balloon && balloon.stats ? balloon.stats.channel : '...';

	const bottomStatsContainerStyle = {
		position: 'fixed',
		bottom: '20px',
		left: '20px',
		zIndex: '4',
		display: 'flex',
		flexDirection: 'column',
		alignItems: 'flex-start',
	};

	const getStyle = (baseStyle, visibilityKey) => ({
		...baseStyle,
		opacity: uiVisibility[visibilityKey] ? 0 : 1,
		transition: 'opacity 0.3s ease',
		pointerEvents: uiVisibility[visibilityKey] ? 'none' : 'auto',
	});

	return (
		<>
			<div style={uiContainerStyle}>
				<div style={getStyle(titleStyle, 'title')} ref={titleRef}>Protoballoon</div>
				<button style={getStyle(buttonStyle, 'about')} ref={aboutButtonRef}>About</button>
				<button style={getStyle(buttonStyle, 'faq')} ref={faqButtonRef}>FAQ</button>
			</div>
			<div style={statsContainerStyle}>
				<div style={statRowStyle}>
					<div style={getStyle(statBoxStyle, 'lastSeen')} ref={lastSeenRef}>
						<div style={statLabelStyle}>LAST UPDATE</div>
						<div style={statValueStyle}>{lastSeenTime}</div>
						<div style={timeAgoStyle}>{timeAgo}</div>
					</div>
					<div style={getStyle(statBoxStyle, 'missionDuration')} ref={missionDurationRef}>
						<div style={statLabelStyle}>MISSION DURATION</div>
						<div style={statValueStyle}>{missionDuration}</div>
						<div style={timeAgoStyle}>{sinceDate}</div>
					</div>
				</div>
				<div style={{...statRowStyle, marginTop: '-1px'}}>
					<div style={getStyle(statBoxStyle, 'lastPosition')} ref={lastPositionRef}>
						<div style={statLabelStyle}>LAST POSITION</div>
						<div style={statValueStyle}>{lastPosition}</div>
					</div>
					<div style={getStyle(statBoxStyle, 'altitude')} ref={altitudeRef}>
						<div style={statLabelStyle}>ALTITUDE</div>
						<div style={statValueStyle}>{altitude}</div>
					</div>
				</div>
			</div>
			<div style={bottomStatsContainerStyle}>
				<div style={statRowStyle}>
					<div style={getStyle(statBoxStyle, 'callsign')} ref={callsignRef}>
						<div style={statLabelStyle}>CALLSIGN</div>
						<div style={statValueStyle}>{callsign}</div>
					</div>
					<div style={getStyle(statBoxStyle, 'band')} ref={bandRef}>
						<div style={statLabelStyle}>BAND</div>
						<div style={statValueStyle}>{band}</div>
					</div>
					<div style={getStyle(statBoxStyle, 'channel')} ref={channelRef}>
						<div style={statLabelStyle}>CHANNEL</div>
						<div style={statValueStyle}>{channel}</div>
					</div>
				</div>
				<div style={{...statRowStyle, marginTop: '-1px'}}>
					<div style={getStyle(statBoxStyle, 'distance')} ref={distanceRef}>
						<div style={statLabelStyle}>DISTANCE TRAVELLED</div>
						<div style={statValueStyle}>{distanceTraveled}</div>
					</div>
					<div style={getStyle(statBoxStyle, 'spots')} ref={spotsRef}>
						<div style={statLabelStyle}>SPOTS</div>
						<div style={statValueStyle}>{spots}</div>
					</div>
					<div style={getStyle(statBoxStyle, 'lapCount')} ref={lapCountRef}>
						<div style={statLabelStyle}>LAP COUNT</div>
						<div style={statValueStyle}>{lapCount}</div>
					</div>
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
