import React, { useState, useEffect, useReducer, useRef } from 'react';
import moment from 'moment-timezone';
import * as THREE from 'three/build/three.module';
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

function TimeAgo(props) {
	const { time } = props;
	const [timeAgo, setTimeAgo] = useState('...');

	useEffect(() => {
		if (!time) {
			setTimeAgo('...');
			return;
		}
		const lastPositionTime = moment.utc(time);
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
	}, [time]);

	return <div className="time-ago">{timeAgo}</div>;
}

function MissionDuration(props) {
	const { startTime } = props;
	const [missionDuration, setMissionDuration] = useState('...');

	useEffect(() => {
		if (!startTime) {
			setMissionDuration('...');
			return;
		}
		const startTimeMoment = moment.utc(startTime);
		const timer = setInterval(() => {
			const now = moment();
			const duration = moment.duration(now.diff(startTimeMoment));
			const days = Math.floor(duration.asDays());
			const hours = String(duration.hours()).padStart(2, '0');
			const minutes = String(duration.minutes()).padStart(2, '0');
			const secondsWithDecimal = (duration.seconds() + duration.milliseconds() / 1000).toFixed(1);
			const paddedSeconds = secondsWithDecimal.padStart(4, '0');
			setMissionDuration(`L+${days}d ${hours}:${minutes}:${paddedSeconds}`);
		}, 100);
		return () => clearInterval(timer);
	}, [startTime]);

	return <div className="stat-value">{missionDuration}</div>;
}

export function Balloon(props) {
	const [balloon, setBalloon] = useState(false);
	const [isBlurred, setIsBlurred] = useState(true);
	const [uiVisibility, setUiVisibility] = useState({});
	const [showAbout, setShowAbout] = useState(false);
	const [showFaq, setShowFaq] = useState(false);
	const [globeReady, setGlobeReady] = useState(false);
	const [globeError, setGlobeError] = useState(false);
	const [hoveredLabel, setHoveredLabel] = useState(null);
	const [isFullscreen, setIsFullscreen] = useState(!!document.fullscreenElement);
	const globeContainerRef = useRef();
	const globeInstanceRef = useRef();
	const globeMaterialRef = useRef();
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
	const fullscreenButtonRef = useRef();
	const telemetryRef = useRef();
	const { width, height } = useWindowSize();
	const isMobile = useIsMobile();

	const enterFullscreen = () => {
		if (!document.fullscreenElement) {
			document.documentElement.requestFullscreen().catch(err => {
				console.error(`Error attempting to enable full-screen mode: ${err.message} (${err.name})`);
			});
		}
	};

	useEffect(() => {
		const handleFullscreenChange = () => {
			setIsFullscreen(!!document.fullscreenElement);
		};
		document.addEventListener('fullscreenchange', handleFullscreenChange);
		return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
	}, []);

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
		const Globe = window.Globe;
		if (Globe && globeContainerRef.current) {
			if (!globeInstanceRef.current && !globeError) {
				try {
					const myGlobe = Globe({ animateIn: false })(globeContainerRef.current)
						.globeTileEngineUrl((x, y, z) => `https://static.my.protospace.ca/balloon-tile/${z}/${x}/${y}.jpg`)
						.backgroundImageUrl('//unpkg.com/three-globe/example/img/night-sky.png')
						.pathPoints('points')
						.pathPointLat(p => p.lat)
						.pathPointLng(p => p.lng)
						.pathPointAlt(p => p.altitudeFt / 20902231) // Earth radius in feet
						.pathStroke(2)
						.pathColor(() => 'rgba(255, 100, 50, 1.0)')
						.pathTransitionDuration(0)
						.labelText(() => '')
						.labelLat(p => p.lat)
						.labelLng(p => p.lng)
						.labelAltitude(p => (p.altitudeFt+100) / 20902231)
						.labelsTransitionDuration(0)
						.labelLabel(p => `
							<div style="padding: 4px; background: rgba(0,0,0,0.5); border-radius: 4px; color: white; white-space: nowrap;">
								<b>${moment.utc(p.time).tz(moment.tz.guess()).format('YYYY-MM-DD HH:mm:ss z')}</b><br />
								Received ${moment.utc(p.time).fromNow()}<br />
								Lat: ${p.lat.toFixed(4)}, Lng: ${p.lng.toFixed(4)}<br />
								Altitude: ${p.altitudeFt.toLocaleString()} ft, Temp: ${p.tempC} °C<br />
								Sun Angle: ${p.solAngle}°, Voltage: ${p.voltage} V
							</div>
						`);
					globeMaterialRef.current = myGlobe.globeMaterial();
					myGlobe.onGlobeReady(() => setGlobeReady(true));
					myGlobe.onZoom(pov => {
						const offset = pov.altitude > 2 ? (pov.altitude - 2) * 0.002 : 0;
						myGlobe.pathPointAlt(p => p.altitudeFt / 20902231 + offset);
						myGlobe.labelDotRadius(pov.altitude * 0.3 + 0.01);
					});
					myGlobe.onLabelHover(setHoveredLabel);
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
			globeInstanceRef.current.labelsData(balloon.positions.slice(0, 25));

			if (isInitialLoad.current) {
				const lastPoint = balloon.positions[0]; // data is reverse chronological

				// Instantly set camera to be looking at the last point from far away
				globeInstanceRef.current.pointOfView({ lat: lastPoint.lat, lng: lastPoint.lng, altitude: 20 });

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
		if (globeInstanceRef.current) {
			globeInstanceRef.current.labelColor(p => (hoveredLabel && p.time === hoveredLabel.time) ? 'rgba(255, 100, 50, 1.0)' : 'rgba(255, 100, 50, 0.60)');
		}
	}, [hoveredLabel]);

	useEffect(() => {
		const globe = globeInstanceRef.current;
		const globeMaterial = globeMaterialRef.current;

		if (!globe || !THREE || !globeReady || !globeMaterial) return;

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
			fullscreen: fullscreenButtonRef,
			telemetry: telemetryRef,
		};

		const checkVisibility = () => {
			const camera = globe.camera();
			const scene = globe.scene();

			const globeMeshes = [];
			scene.traverse(object => {
				if (object.isMesh && object.material === globeMaterial) {
					globeMeshes.push(object);
				}
			});

			if (globeMeshes.length === 0) return;

			const newVisibility = {};
			for (const [name, ref] of Object.entries(refsToCheck)) {
				if (ref.current) {
					const rect = ref.current.getBoundingClientRect();
					const x = rect.left + rect.width / 2;
					const y = rect.top + rect.height / 2;

					ndc.x = (x / window.innerWidth) * 2 - 1;
					ndc.y = -(y / window.innerHeight) * 2 + 1;

					raycaster.setFromCamera(ndc, camera);
					const intersects = raycaster.intersectObjects(globeMeshes, true);
					newVisibility[name] = intersects.length > 0;
				}
			}
			setUiVisibility(prevVisibility => {
				const allKeys = new Set([...Object.keys(prevVisibility), ...Object.keys(newVisibility)]);
				for (const key of allKeys) {
					if (prevVisibility[key] !== newVisibility[key]) {
						return newVisibility; // Found a difference, update state
					}
				}
				return prevVisibility; // No difference, return old state
			});
		};

		const interval = setInterval(checkVisibility, 200);
		return () => clearInterval(interval);
	}, [width, height, balloon, globeReady]);


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
		const isButton = visibilityKey === 'about' || visibilityKey === 'faq' || visibilityKey === 'fullscreen';
		return {
			opacity: uiVisibility[visibilityKey] ? 0 : 1,
			transition: 'opacity 0.3s ease',
			pointerEvents: (isButton && !uiVisibility[visibilityKey]) ? 'auto' : 'none',
			cursor: (isButton && !uiVisibility[visibilityKey]) ? 'pointer' : 'default',
		};
	};

	return (
		<div className="balloon-dashboard">
			<div className="ui-container">
				<div className="title" style={getStyle('title')} ref={titleRef}>Protoballoon</div>
				<button className="button" style={getStyle('about')} ref={aboutButtonRef} onClick={() => setShowAbout(true)}>About</button>
				<button className="button" style={getStyle('faq')} ref={faqButtonRef} onClick={() => setShowFaq(true)}>FAQ</button>
			</div>
			{!isMobile &&
				<div className="top-right-container">
					<div className="stat-box" style={getStyle('telemetry')} ref={telemetryRef}>
						<div className="stat-label">LATEST TELEMETRY</div>
						<div className="stat-value">
							{balloon?.positions?.slice(0, 5).map((pos, index) => (
								<div key={pos.time} style={{ marginTop: index > 0 ? '0.5em' : 0 }}>
									<div>{moment.utc(pos.time).tz(moment.tz.guess()).format('YYYY-MM-DD HH:mm z')}</div>
									<div>{`${pos.lat.toFixed(5)}, ${pos.lng.toFixed(4)}`}</div>
									<div>{`${pos.altitudeFt.toLocaleString()} FT, ${pos.tempC} °C`}</div>
									<div>{`SUN: ${pos.solAngle}°, ${pos.voltage.toFixed(2)} V`}</div>
								</div>
							))}
						</div>
					</div>
				</div>
			}
			<div className="stats-container">
				<div className="stat-row">
					<div className="stat-box" style={getStyle('lastSeen')} ref={lastSeenRef}>
						<div className="stat-label">LAST UPDATE</div>
						<div className="stat-value">{lastSeenTime}</div>
						<TimeAgo time={balloon?.positions?.[0]?.time} />
					</div>
					<div className="stat-box" style={getStyle('missionDuration')} ref={missionDurationRef}>
						<div className="stat-label">MISSION DURATION</div>
						<MissionDuration startTime={balloon?.stats?.timeStart} />
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
						<div className="stat-value">TRY A DIFFERENT BROWSER</div>
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
			<div className="bottom-right-container">
				{!isMobile && !isFullscreen && (
					<div
						ref={fullscreenButtonRef}
						className="stat-box fullscreen-button"
						style={getStyle('fullscreen')}
						onClick={enterFullscreen}
					>
						<div className="fullscreen-icon-container">
							<div className="fullscreen-icon-corner top-left" />
							<div className="fullscreen-icon-corner top-right" />
							<div className="fullscreen-icon-corner bottom-left" />
							<div className="fullscreen-icon-corner bottom-right" />
						</div>
					</div>
				)}
			</div>
			{showAbout && <BalloonAbout onClose={() => setShowAbout(false)} />}
			{showFaq && <BalloonFAQ onClose={() => setShowFaq(false)} />}
		</div>
	);
};
