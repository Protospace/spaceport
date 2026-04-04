import React, { useState, useEffect, useReducer, useRef } from 'react';
import moment from 'moment-timezone';
import { requester, useIsMobile, useWindowSize } from './utils.js';
import './balloon.css';

function InfoModal(props) {
	const { url, onClose } = props;
	const [content, setContent] = useState('');

	useEffect(() => {
		fetch(url)
			.then(response => response.text())
			.then(html => {
				const parser = new DOMParser();
				const doc = parser.parseFromString(html, 'text/html');
				const readingView = doc.querySelector('div.markdown-reading-view');
				if (readingView) {
					setContent(readingView.innerHTML);
				}
			})
			.catch(error => {
				console.error('Error fetching content:', error);
				setContent('<p>Could not load content.</p>');
			});
	}, [url]);

	return (
		<div className="modal-overlay" onClick={onClose}>
			<div className="modal-content" onClick={e => e.stopPropagation()}>
				<button className="modal-close-button" onClick={onClose}>×</button>
				{content ? (
					<div dangerouslySetInnerHTML={{ __html: content }} />
				) : (
					<p><br/>Loading...<br/></p>
				)}
			</div>
		</div>
	);
}

export function BalloonAbout(props) {
	const { onClose } = props;
	return <InfoModal url="https://notes.dns.t0.vc/protoballoon-about-68e679" onClose={onClose} />;
}

export function BalloonFAQ(props) {
	const { onClose } = props;
	return <InfoModal url="https://notes.dns.t0.vc/protoballoon-faq-8d3644" onClose={onClose} />;
}

export function Balloon(props) {
	const [balloon, setBalloon] = useState(false);
	const [timeAgo, setTimeAgo] = useState('...');
	const [missionDuration, setMissionDuration] = useState('...');
	const [isBlurred, setIsBlurred] = useState(true);
	const [uiVisibility, setUiVisibility] = useState({});
	const [showAbout, setShowAbout] = useState(false);
	const [showFaq, setShowFaq] = useState(false);
	const [globeReady, setGlobeReady] = useState(false);
	const [globeError, setGlobeError] = useState(false);
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
	const isMobile = useIsMobile();

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
			if (!globeInstanceRef.current && !globeError) {
				try {
					const myGlobe = Globe({ animateIn: false })(globeContainerRef.current)
						.globeImageUrl('//unpkg.com/three-globe/example/img/earth-blue-marble.jpg')
						.bumpImageUrl('//unpkg.com/three-globe/example/img/earth-topology.png')
						.backgroundImageUrl('//unpkg.com/three-globe/example/img/night-sky.png')
						.pathPoints('points')
						.pathPointLat(p => p.lat)
						.pathPointLng(p => p.lng)
						.pathPointAlt(p => p.altitudeFt / 20902231 + 0.05) // Earth radius in feet, plus offset to avoid Z-fighting
						.pathStroke(2)
						.pathColor(() => 'rgba(255, 100, 50, 1.0)')
						.pathTransitionDuration(0);
					myGlobe.onGlobeReady(() => setGlobeReady(true));
					globeInstanceRef.current = myGlobe;
				} catch (e) {
					console.error('Error initializing Globe:', e);
					setGlobeError(true);
				}
			}
			if (globeInstanceRef.current) {
				globeInstanceRef.current.width(width).height(height);
			}
		}
	}, [width, height, globeError]);

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

		if (!globe || !THREE || !globeReady) return;

		const camera = globe.camera();
		const scene = globe.scene();

		let globeMesh;
		scene.traverse(object => {
			// The globe is a mesh with sphere geometry
			if (object.isMesh && object.geometry.type === 'SphereGeometry') {
				globeMesh = object;
			}
		});

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
			setUiVisibility(newVisibility);
		};

		const interval = setInterval(checkVisibility, 200);
		return () => clearInterval(interval);
	}, [width, height, balloon, globeReady]);


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

	const getStyle = (visibilityKey) => {
		const isButton = visibilityKey === 'about' || visibilityKey === 'faq';
		return {
			opacity: uiVisibility[visibilityKey] ? 0 : 1,
			transition: 'opacity 0.3s ease',
			pointerEvents: (isButton && !uiVisibility[visibilityKey]) ? 'auto' : 'none',
		};
	};

	return (
		<>
			<div className="ui-container">
				<div className="title" style={getStyle('title')} ref={titleRef}>Protoballoon</div>
				<button className="button" style={getStyle('about')} ref={aboutButtonRef} onClick={() => setShowAbout(true)}>About</button>
				<button className="button" style={getStyle('faq')} ref={faqButtonRef} onClick={() => setShowFaq(true)}>FAQ</button>
			</div>
			<div className="stats-container">
				<div className="stat-row">
					<div className="stat-box" style={getStyle('lastSeen')} ref={lastSeenRef}>
						<div className="stat-label">LAST UPDATE</div>
						<div className="stat-value">{lastSeenTime}</div>
						<div className="time-ago">{timeAgo}</div>
					</div>
					<div className="stat-box" style={getStyle('missionDuration')} ref={missionDurationRef}>
						<div className="stat-label">MISSION DURATION</div>
						<div className="stat-value">{missionDuration}</div>
						<div className="time-ago">{sinceDate}</div>
					</div>
				</div>
				{!isMobile &&
					<div className="stat-row">
						<div className="stat-box" style={getStyle('lastPosition')} ref={lastPositionRef}>
							<div className="stat-label">LAST POSITION</div>
							<div className="stat-value">{lastPosition}</div>
						</div>
						<div className="stat-box" style={getStyle('altitude')} ref={altitudeRef}>
							<div className="stat-label">ALTITUDE</div>
							<div className="stat-value">{altitude}</div>
						</div>
					</div>
				}
			</div>
			<div className="bottom-stats-container">
				<div className="stat-row">
					<div className="stat-box" style={getStyle('callsign')} ref={callsignRef}>
						<div className="stat-label">CALLSIGN</div>
						<div className="stat-value">{callsign}</div>
					</div>
					<div className="stat-box" style={getStyle('band')} ref={bandRef}>
						<div className="stat-label">BAND</div>
						<div className="stat-value">{band}</div>
					</div>
					<div className="stat-box" style={getStyle('channel')} ref={channelRef}>
						<div className="stat-label">CHANNEL</div>
						<div className="stat-value">{channel}</div>
					</div>
				</div>
				<div className="stat-row">
					<div className="stat-box" style={getStyle('distance')} ref={distanceRef}>
						<div className="stat-label">DISTANCE TRAVELLED</div>
						<div className="stat-value">{distanceTraveled}</div>
					</div>
					<div className="stat-box" style={getStyle('spots')} ref={spotsRef}>
						<div className="stat-label">SPOTS</div>
						<div className="stat-value">{spots}</div>
					</div>
					<div className="stat-box" style={getStyle('lapCount')} ref={lapCountRef}>
						<div className="stat-label">LAP COUNT</div>
						<div className="stat-value">{lapCount}</div>
					</div>
				</div>
				{isMobile &&
					<div className="stat-row">
						<div className="stat-box" style={getStyle('lastPosition')} ref={lastPositionRef}>
							<div className="stat-label">LAST POSITION</div>
							<div className="stat-value">{lastPosition}</div>
						</div>
						<div className="stat-box" style={getStyle('altitude')} ref={altitudeRef}>
							<div className="stat-label">ALTITUDE</div>
							<div className="stat-value">{altitude}</div>
						</div>
					</div>
				}
			</div>
			{globeError ? (
				<div className="globe-error-container">
					<div className="stat-box">
						<div className="stat-label">ERROR</div>
						<div className="stat-value">UNABLE TO RENDER GLOBE</div>
					</div>
				</div>
			) : (
				<div
					ref={globeContainerRef}
					className="globe-container"
					style={{
						filter: isBlurred ? 'blur(8px)' : 'none',
						transition: 'filter 0.8s ease-out',
					}}
				/>
			)}
			{showAbout && <BalloonAbout onClose={() => setShowAbout(false)} />}
			{showFaq && <BalloonFAQ onClose={() => setShowFaq(false)} />}
		</>
	);
};
