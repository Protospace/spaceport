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
	const windParticlesRef = useRef();
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
		if (globe && THREE && globeReady && !windParticlesRef.current) {
			const globeRadius = 101;
			const EARTH_RADIUS_METERS = 6371e3;
			let animationFrameId;

			// Tunable animation parameters
			const PARTICLE_COUNT = 5000; // Total number of wind particles
			const PARTICLE_DENSITY_ZOOM_MULTIPLIER = 0.5; // Higher value means more particles visible when zoomed in.
			const PARTICLE_SPEED_FACTOR = 200; // Multiplier for particle speed
			const PARTICLE_MAX_AGE = 4000; // Steps before a particle is respawned
			const TAIL_LENGTH = 10; // Length of particle tails in animation steps
			const PARTICLE_MIN_SPEED_TO_RENDER = 0.0; // Min speed to be visible
			const PARTICLE_MAX_SPEED_TO_RENDER = 30.0; // Max speed for color mapping
			const PARTICLE_ALPHA = 0.6; // Base transparency of particles

			const activeParticleCount = { current: PARTICLE_COUNT };
			const originalOnZoom = globe.onZoom();
			globe.onZoom(pov => {
				if (originalOnZoom) originalOnZoom(pov);
				const zoomFactor = Math.min(1.0, pov.altitude * PARTICLE_DENSITY_ZOOM_MULTIPLIER);
				activeParticleCount.current = Math.floor(PARTICLE_COUNT * zoomFactor);
			});

			const buildVectorField = (epakData) => {
				const ppakBlocks = epakData.blocks.filter(b => b.type === 'ppak');
				const uBlock = ppakBlocks[0];
				const vBlock = ppakBlocks[1];

				const vectorField = {
					cols: uBlock.cols,
					rows: uBlock.rows,
					u: uBlock.data,
					v: vBlock.data,
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
				const theta = (lon + 180) * Math.PI / 180;
				return new THREE.Vector3().setFromSphericalCoords(radius, phi, theta);
			};

			fetch('https://static.my.protospace.ca/wind-data/current-wind-isobaric-250hPa-gfs-0.5.epak')
				.then(response => response.arrayBuffer())
				.then(arrayBuffer => {
					const vectorField = buildVectorField(parseEpak(arrayBuffer));

					const particles = [];

					const vector3ToLonLat = (vector) => {
						const spherical = new THREE.Spherical().setFromVector3(vector);
						const lat = 90 - THREE.MathUtils.radToDeg(spherical.phi);
						let theta = spherical.theta;
						if (theta < 0) theta += 2 * Math.PI;
						const lon = THREE.MathUtils.radToDeg(theta) - 180;
						return { lon, lat };
					};

					const globeSphere = new THREE.Sphere(new THREE.Vector3(0, 0, 0), globeRadius);
					const raycaster = new THREE.Raycaster();

					const respawnParticle = (p, camera) => {
						let intersectionPoint = null;
						let attempts = 0;
						const MAX_ATTEMPTS = 20;

						while (!intersectionPoint && attempts < MAX_ATTEMPTS) {
							const screenX = Math.random() * 2 - 1;
							const screenY = Math.random() * 2 - 1;
							raycaster.setFromCamera({ x: screenX, y: screenY }, camera);
							intersectionPoint = raycaster.ray.intersectSphere(globeSphere, new THREE.Vector3());
							attempts++;
						}

						if (intersectionPoint) {
							const { lon, lat } = vector3ToLonLat(intersectionPoint);
							p.lon = lon;
							p.lat = lat;
							p.age = Math.floor(Math.random() * PARTICLE_MAX_AGE);
						} else {
							p.age = PARTICLE_MAX_AGE + 1; // Mark as "dead" if no spot found
						}
						return p;
					};

					const camera = globe.camera();
					for (let i = 0; i < PARTICLE_COUNT; i++) {
						particles.push(respawnParticle({}, camera));
					}

					const particlesGeometry = new THREE.BufferGeometry();
					const positions = new Float32Array(PARTICLE_COUNT * 3 * 2);
					const particleSpeeds = new Float32Array(PARTICLE_COUNT * 2);
					particlesGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
					particlesGeometry.setAttribute('speed', new THREE.BufferAttribute(particleSpeeds, 1));

					const vertexShader = `
						attribute float speed;
						varying float v_speed;
						void main() {
							gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
							v_speed = speed;
						}
					`;

					const fragmentShader = `
						varying float v_speed;

						vec3 colorMap(float t) { // t is 0..1
							vec3 blue = vec3(0.2, 0.2, 1.0);
							vec3 green = vec3(0.2, 1.0, 0.2);
							vec3 yellow = vec3(1.0, 1.0, 0.2);
							if (t < 0.5) {
								return mix(blue, green, t * 2.0);
							} else {
								return mix(green, yellow, (t - 0.5) * 2.0);
							}
						}

						void main() {
							float normalized_speed = clamp(abs(v_speed), ${PARTICLE_MIN_SPEED_TO_RENDER.toFixed(1)}, ${PARTICLE_MAX_SPEED_TO_RENDER.toFixed(1)}) / ${PARTICLE_MAX_SPEED_TO_RENDER.toFixed(1)};
							float alpha = smoothstep(${PARTICLE_MIN_SPEED_TO_RENDER.toFixed(1)}, ${PARTICLE_MAX_SPEED_TO_RENDER.toFixed(1)}, abs(v_speed)) * ${PARTICLE_ALPHA.toFixed(1)} + 0.4;
							gl_FragColor = vec4(colorMap(normalized_speed), alpha);
						}
					`;

					const particlesMaterial = new THREE.ShaderMaterial({
						vertexShader,
						fragmentShader,
						transparent: true,
						blending: THREE.AdditiveBlending,
						depthWrite: false,
					});

					const windParticles = new THREE.LineSegments(particlesGeometry, particlesMaterial);
					windParticlesRef.current = windParticles;
					globe.scene().add(windParticles);

					const animate = () => {
						const positions = particlesGeometry.attributes.position.array;
						const speeds = particlesGeometry.attributes.speed.array;
						const camera = globe.camera();
						const currentActiveCount = activeParticleCount.current;

						particles.forEach((p, i) => {
							if (i >= currentActiveCount) {
								// Hide particle if it's beyond the active count
								positions[i * 6 + 0] = positions[i * 6 + 3] = 0;
								positions[i * 6 + 1] = positions[i * 6 + 4] = 0;
								positions[i * 6 + 2] = positions[i * 6 + 5] = 0;
								return;
							}

							// Respawn particle if it's on the back of the globe, off-screen, or too old
							const particlePos = lonLatToVector3(p.lon, p.lat, globeRadius);
							const angle = camera.position.angleTo(particlePos);
							const screenPos = particlePos.clone().project(camera);
							const isOffScreen = screenPos.x < -1.1 || screenPos.x > 1.1 || screenPos.y < -1.1 || screenPos.y > 1.1;

							if (p.age++ > PARTICLE_MAX_AGE || angle > Math.PI / 2 || isOffScreen) {
								respawnParticle(p, camera);
							}

							if (p.age > PARTICLE_MAX_AGE) {
								// Particle is "dead" (couldn't be respawned visibly). Hide it.
								positions[i * 6 + 0] = positions[i * 6 + 3] = 0;
								positions[i * 6 + 1] = positions[i * 6 + 4] = 0;
								positions[i * 6 + 2] = positions[i * 6 + 5] = 0;
								return;
							}

							const [u, v] = vectorField.interpolate(p.lon, p.lat);
							const speed = Math.sqrt(u * u + v * v);

							const dt = PARTICLE_SPEED_FACTOR;
							const dx = u * dt;
							const dy = v * dt;
							const cos_lat = Math.cos(p.lat * Math.PI / 180);
							const dLon = dx * 180 / (Math.PI * EARTH_RADIUS_METERS * Math.max(cos_lat, 0.05)); // Avoid division by zero at poles
							const dLat = dy * 180 / (Math.PI * EARTH_RADIUS_METERS);

							const head_pos = lonLatToVector3(p.lon, p.lat, globeRadius);
							positions[i * 6 + 3] = head_pos.x;
							positions[i * 6 + 4] = head_pos.y;
							positions[i * 6 + 5] = head_pos.z;

							const tail_lon = p.lon - dLon * TAIL_LENGTH;
							const tail_lat = p.lat - dLat * TAIL_LENGTH;
							const tail_pos = lonLatToVector3(tail_lon, tail_lat, globeRadius);
							positions[i * 6 + 0] = tail_pos.x;
							positions[i * 6 + 1] = tail_pos.y;
							positions[i * 6 + 2] = tail_pos.z;

							speeds[i * 2] = speed;
							speeds[i * 2 + 1] = speed;

							p.lon += dLon;
							p.lat += dLat;

							if (p.lon > 180) p.lon -= 360;
							if (p.lon < -180) p.lon += 360;
							if (p.lat > 90 || p.lat < -90) respawnParticle(p, camera);
						});

						particlesGeometry.attributes.position.needsUpdate = true;
						particlesGeometry.attributes.speed.needsUpdate = true;
						animationFrameId = requestAnimationFrame(animate);
					};
					animate();

				})
				.catch(error => console.error('Error loading wind data:', error));

			return () => {
				cancelAnimationFrame(animationFrameId);
				if (windParticlesRef.current && globe.scene()) {
					globe.scene().remove(windParticlesRef.current);
					windParticlesRef.current.geometry.dispose();
					windParticlesRef.current.material.dispose();
					windParticlesRef.current = null;
				}
				if (globe) {
					globe.onZoom(originalOnZoom);
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
