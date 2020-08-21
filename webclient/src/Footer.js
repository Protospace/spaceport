import React, { useRef, useEffect } from 'react';
import { Container, Icon } from 'semantic-ui-react';
import * as THREE from 'three/build/three.module';
import { Ship } from './spaceport/Ship';

export const Footer = () => {
	const footerRef = useRef();

	useEffect(() => {
		if (!footerRef.current) return;

		let t = 0.01;
		const shipInterval = 2;
		let nextShip = shipInterval;

		var scene = new THREE.Scene();
		const renderer = new THREE.WebGLRenderer({ antialias: true });
		renderer.setSize(
			footerRef.current.clientWidth,
			footerRef.current.clientHeight
		);

		const camera = new THREE.PerspectiveCamera(65, 1, 0.01, 1000);
		camera.position.set(4, 1, 4);
		camera.lookAt(new THREE.Vector3(-8, 0, -2));

		scene.add(camera);

		footerRef.current.appendChild(renderer.domElement);

		let ships = [];
		const ship = new Ship();
		scene.add(ship.mesh);
		ships.push(ship);

		const animate = () => {
			const deltaTime = 0.075;
			t += deltaTime;

			// get mouse

			if (t > nextShip) {
				console.log('bing');
				const ship = new Ship();
				scene.add(ship.mesh);
				ships.push(ship);
				nextShip += shipInterval + (Math.random() - 0.5) * 2;
			}

			for (const ship of ships) {
				ship.update({ deltaTime });
				if (ship.kill) {
					console.log('killing ship');
					scene.remove(ship.mesh);
				}
			}

			ships = ships.filter((s) => !s.kill);

			requestAnimationFrame(animate);
			renderer.render(scene, camera);
		};

		animate();

		renderer.render(scene, camera);
	}, [footerRef]);

	return (
		<div className="footer" ref={footerRef}>
			<Container className="footer-content">
				<p>
					<img
						alt="site logo"
						src="/logo-short.svg"
						className="logo"
					/>
				</p>

				<p className="text">
					Contact us:{' '}
					<a
						href="mailto:info@protospace.ca"
						target="_blank"
						rel="noopener noreferrer"
					>
						info@protospace.ca
					</a>
				</p>

				<p className="text">
					Created and hosted by Protospace members for Protospace
					members.
				</p>

				<p className="text">
					Spaceport is free and open-source software.{' '}
					<a
						href="https://github.com/Protospace/spaceport"
						target="_blank"
						rel="noopener noreferrer"
					>
						Click here
					</a>{' '}
					to view the source code and license.
				</p>

				<p>
					<a
						href="https://instagram.com/protospace"
						target="_blank"
						rel="noopener noreferrer"
						aria-label="link to our instagram"
					>
						<Icon name="instagram" size="large" />
					</a>
					<a
						href="https://twitter.com/protospace"
						target="_blank"
						rel="noopener noreferrer"
						aria-label="link to our twitter"
					>
						<Icon name="twitter" size="large" />
					</a>
					<a
						href="https://youtube.com/user/calgaryprotospace/playlists"
						target="_blank"
						rel="noopener noreferrer"
						aria-label="link to our youtube"
					>
						<Icon name="youtube" size="large" />
					</a>
					<a
						href="https://github.com/Protospace"
						target="_blank"
						rel="noopener noreferrer"
						aria-label="link to our github"
					>
						<Icon name="github" size="large" />
					</a>
					<a
						href="https://docs.my.protospace.ca"
						target="_blank"
						rel="noopener noreferrer"
						aria-label="link to our docs"
					>
						<Icon name="book" size="large" />
					</a>
				</p>

				<p>© 2020 Calgary Protospace Ltd.</p>
			</Container>
		</div>
	);
};
