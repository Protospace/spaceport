import React, { useState, useEffect, useReducer, useRef } from 'react';
import moment from 'moment-timezone';
import * as THREE from 'three/build/three.module';
import { requester, useIsMobile, useWindowSize } from './utils.js';
import { parseEpak } from './utils-balloon.js';
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
	const windDotsRef = useRef();
	const windVectorsRef = useRef();
	const isInitialLoad = useRef(true);
	const titleRef = useRef();
	const aboutButtonRef = useRef();
	const faqButtonRef = useRef();
	const lastSeenRef = useRef();
	const missionDurationRef = useRef();
	const lastPositionRef = useRef();
	const altitudeRef = useRef();
	const voltageRef = useRef();
	const temperatureRef = useRef();
	const sunAngleRef = useRef();
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
		if (globe && THREE && globeReady && !windVectorsRef.current) {
			const globeRadius = 101;
			const EARTH_RADIUS_METERS = 6371e3;

			const buildVectorField = (epakData) => {
				const ppakBlocks = epakData.blocks.filter(b => b.type === 'ppak');
				const uBlock = ppakBlocks[0];
				const vBlock = ppakBlocks[1];

				const { cols, rows } = uBlock;
				const u_orig = uBlock.data;
				const v_orig = vBlock.data;
				const u_mirrored = new Float32Array(u_orig.length);
				const v_mirrored = new Float32Array(v_orig.length);

				for (let j = 0; j < rows; j++) {
					for (let i = 0; i < cols; i++) {
						const source_i = cols - 1 - i;
						const source_index = j * cols + source_i;
						const target_index = j * cols + i;
						u_mirrored[target_index] = -u_orig[source_index];
						v_mirrored[target_index] = v_orig[source_index];
					}
				}

				const vectorField = {
					cols: uBlock.cols,
					rows: uBlock.rows,
					u: u_mirrored,
					v: v_mirrored,
					interpolate: (lon, lat) => {
						const i = (lon + 180) / (360 / vectorField.cols);
						const j = (90 - lat) / (180 / (vectorField.rows - 1));

						const i0 = Math.floor(i);
						const j0 = Math.floor(j);
						const i1 = (i0 + 1) % vectorField.cols;
						const j1 = Math.min(j0 + 1, vectorField.rows - 1);

						if (j0 < 0 || j1 >= vectorField.rows) return [0, 0];

						const lat0 = 90 - j0 * (180 / (vectorField.rows - 1));
						const lat1 = 90 - j1 * (180 / (vectorField.rows - 1));
						const cos_lat0 = Math.cos(lat0 * Math.PI / 180);
						const cos_lat1 = Math.cos(lat1 * Math.PI / 180);

						// Correct for equirectangular projection distortion by interpolating angular velocity instead of linear
						const u00 = vectorField.u[j0 * vectorField.cols + i0] / cos_lat0;
						const u10 = vectorField.u[j0 * vectorField.cols + i1] / cos_lat0;
						const u01 = vectorField.u[j1 * vectorField.cols + i0] / cos_lat1;
						const u11 = vectorField.u[j1 * vectorField.cols + i1] / cos_lat1;

						const v00 = vectorField.v[j0 * vectorField.cols + i0];
						const v10 = vectorField.v[j0 * vectorField.cols + i1];
						const v01 = vectorField.v[j1 * vectorField.cols + i0];
						const v11 = vectorField.v[j1 * vectorField.cols + i1];

						const x = i - i0;
						const y = j - j0;

						const u_angular = u00 * (1 - x) * (1 - y) + u10 * x * (1 - y) + u01 * (1 - x) * y + u11 * x * y;
						const v = v00 * (1 - x) * (1 - y) + v10 * x * (1 - y) + v01 * (1 - x) * y + v11 * x * y;

						const u = u_angular * Math.cos(lat * Math.PI / 180);

						return [u, v];
					}
				};
				return vectorField;
			};

			const lonLatToVector3 = (lon, lat, radius) => {
				const phi = (90 - lat) * Math.PI / 180;
				const theta = (270 - lon) * Math.PI / 180;
				const x = -radius * Math.sin(phi) * Math.cos(theta);
				const y = radius * Math.cos(phi);
				const z = radius * Math.sin(phi) * Math.sin(theta);
				return new THREE.Vector3(x, y, z);
			};

			fetch('https://static.my.protospace.ca/wind-data/current-wind-isobaric-250hPa-gfs-0.5.epak')
				.then(response => response.arrayBuffer())
				.then(arrayBuffer => {
					const vectorField = buildVectorField(parseEpak(arrayBuffer));

					const runWindDataTests = (vf) => {
						console.log("--- Running wind data integrity tests ---");
						const tests = [
							{ lat: 39.96, lng: -120.71, expected_mag: 64, expected_dir: 265 },
							{ lat: 33.84, lng: -120.82, expected_mag: 167, expected_dir: 250 },
							{ lat: 24.85, lng: -34.91, expected_mag: 36, expected_dir: 85 },
							{ lat: -27.30, lng: 160.02, expected_mag: 179, expected_dir: 270 },
							{ lat: -43.57, lng: 171.34, expected_mag: 193, expected_dir: 350 },
							{ lat: 40.39, lng: -8.57, expected_mag: 193, expected_dir: 350 },
						];

						const mag_tolerance = 10; // km/h
						const dir_tolerance = 10; // degrees

						tests.forEach(({ lat, lng, expected_mag, expected_dir }) => {
							const [u, v] = vf.interpolate(lng, lat);
							const magnitude_ms = Math.sqrt(u * u + v * v);
							const magnitude_kmh = magnitude_ms * 3.6;

							let direction_deg = (270 - (Math.atan2(v, u) * 180 / Math.PI));
							direction_deg = (direction_deg % 360 + 360) % 360;

							const mag_diff = Math.abs(magnitude_kmh - expected_mag);
							const mag_result = mag_diff <= mag_tolerance ? "PASS" : "FAIL";

							const dir_diff = Math.abs(direction_deg - expected_dir);
							const angular_diff = Math.min(dir_diff, 360 - dir_diff);
							const dir_result = angular_diff <= dir_tolerance ? "PASS" : "FAIL";

							console.log(`Test at (lat: ${lat.toFixed(2)}, lng: ${lng.toFixed(2)})`);
							console.log(`  Magnitude: Expected: ${expected_mag} km/h, Actual: ${magnitude_kmh.toFixed(2)} km/h. Diff: ${mag_diff.toFixed(2)}. Result: ${mag_result}`);
							console.log(`  Direction: Expected: ${expected_dir}°, Actual: ${direction_deg.toFixed(2)}°. Diff: ${angular_diff.toFixed(2)}. Result: ${dir_result}`);
						});
						console.log("--- Wind data tests complete ---");
					};
					runWindDataTests(vectorField);

					// Add red dots and vectors for wind data points
					const VECTOR_SCALE_FACTOR = 5000;
					const dotsGeometry = new THREE.BufferGeometry();
					const dotsPositions = new Float32Array(vectorField.cols * (vectorField.rows - 4) * 3);
					const linesGeometry = new THREE.BufferGeometry();
					const linesPositions = new Float32Array(vectorField.cols * (vectorField.rows - 4) * 3 * 2);
					let dotIndex = 0;
					let lineIndex = 0;

					// Exclude 2 rows from each pole to avoid visual artifacts
					for (let j = 2; j < vectorField.rows - 2; j++) {
						for (let i = 0; i < vectorField.cols; i++) {
							let lon = -180 + i * (360 / vectorField.cols);
							const lat = 90 - j * (180 / (vectorField.rows - 1));
							const pos = lonLatToVector3(lon, lat, globeRadius);
							dotsPositions[dotIndex++] = pos.x;
							dotsPositions[dotIndex++] = pos.y;
							dotsPositions[dotIndex++] = pos.z;

							const [u, v] = vectorField.interpolate(lon, lat);
							const dt = VECTOR_SCALE_FACTOR;
							const dx = u * dt;
							const dy = v * dt;
							const dLon = dx * 180 / (Math.PI * EARTH_RADIUS_METERS * Math.cos(lat * Math.PI / 180));
							const dLat = dy * 180 / (Math.PI * EARTH_RADIUS_METERS);

							const end_pos = lonLatToVector3(lon + dLon, lat + dLat, globeRadius);
							linesPositions[lineIndex++] = pos.x;
							linesPositions[lineIndex++] = pos.y;
							linesPositions[lineIndex++] = pos.z;
							linesPositions[lineIndex++] = end_pos.x;
							linesPositions[lineIndex++] = end_pos.y;
							linesPositions[lineIndex++] = end_pos.z;
						}
					}
					dotsGeometry.setAttribute('position', new THREE.BufferAttribute(dotsPositions, 3));
					const dotsMaterial = new THREE.PointsMaterial({ color: 0xff0000, size: 0.2 });
					const windDots = new THREE.Points(dotsGeometry, dotsMaterial);
					windDotsRef.current = windDots;
					globe.scene().add(windDots);

					linesGeometry.setAttribute('position', new THREE.BufferAttribute(linesPositions, 3));
					const linesMaterial = new THREE.LineBasicMaterial({ color: 0xff0000, transparent: true, opacity: 0.7 });
					const windVectors = new THREE.LineSegments(linesGeometry, linesMaterial);
					windVectorsRef.current = windVectors;
					globe.scene().add(windVectors);

				})
				.catch(error => console.error('Error loading wind data:', error));

			return () => {
				if (windDotsRef.current && globe.scene()) {
					globe.scene().remove(windDotsRef.current);
					windDotsRef.current.geometry.dispose();
					windDotsRef.current.material.dispose();
					windDotsRef.current = null;
				}
				if (windVectorsRef.current && globe.scene()) {
					globe.scene().remove(windVectorsRef.current);
					windVectorsRef.current.geometry.dispose();
					windVectorsRef.current.material.dispose();
					windVectorsRef.current = null;
				}
			};
		}
	}, [globeReady]);

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
			voltage: voltageRef,
			temperature: temperatureRef,
			sunAngle: sunAngleRef,
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

	const voltage = balloon && balloon.positions && balloon.positions.length > 0
		? `${balloon.positions[0].voltage.toFixed(2)} V`
		: '...';

	const temperature = balloon && balloon.positions && balloon.positions.length > 0
		? `${balloon.positions[0].tempC} °C`
		: '...';

	const sunAngle = balloon && balloon.positions && balloon.positions.length > 0
		? `${balloon.positions[0].solAngle}°`
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
					<>
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
						<div className="stat-row">
							<div className="stat-box" style={getStyle('voltage')} ref={voltageRef}>
								<div className="stat-label">VOLTAGE</div>
								<div className="stat-value">{voltage}</div>
							</div>
							<div className="stat-box" style={getStyle('temperature')} ref={temperatureRef}>
								<div className="stat-label">TEMPERATURE</div>
								<div className="stat-value">{temperature}</div>
							</div>
							<div className="stat-box" style={getStyle('sunAngle')} ref={sunAngleRef}>
								<div className="stat-label">SUN ANGLE</div>
								<div className="stat-value">{sunAngle}</div>
							</div>
						</div>
					</>
				}
			</div>
			<div className="bottom-stats-container">
				{isMobile ?
					<div className="stat-row">
						<div className="stat-box" style={getStyle('voltage')} ref={voltageRef}>
							<div className="stat-label">VOLTAGE</div>
							<div className="stat-value">{voltage}</div>
						</div>
						<div className="stat-box" style={getStyle('temperature')} ref={temperatureRef}>
							<div className="stat-label">TEMPERATURE</div>
							<div className="stat-value">{temperature}</div>
						</div>
						<div className="stat-box" style={getStyle('sunAngle')} ref={sunAngleRef}>
							<div className="stat-label">SUN ANGLE</div>
							<div className="stat-value">{sunAngle}</div>
						</div>
					</div>
				:
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
				}
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
