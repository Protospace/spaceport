import * as THREE from 'three/build/three.module';
import { Ship } from './Ship';
import { Laser } from './Laser';

export const scene = ({ ref }) => {
	// TODO: add waves of ships
	// TODO: add stars
	// TODO: use aspect ratio to determine space docking point

	let t = 0.01;
	const shipInterval = 1;
	let nextShip = shipInterval;

	var scene = new THREE.Scene();

	let renderer = null;
	try {
		renderer = new THREE.WebGLRenderer({ antialias: true });
	} catch (error) {
		console.log('Problem creating WebGLRenderer:', error);
		return;
	}

	const width = ref.current.clientWidth;
	const height = ref.current.clientHeight;

	renderer.setSize(width, height);

	const camera = new THREE.PerspectiveCamera(65, width / height, 0.01, 1000000);

	camera.position.set(5, 2, 1);
	camera.lookAt(new THREE.Vector3(0, 0, 0));
	scene.add(camera);

	ref.current.appendChild(renderer.domElement);

	const light1 = new THREE.DirectionalLight('#fff', 1);
	light1.position.x = 3;
	light1.position.z = 1;
	scene.add(light1);

	const light2 = new THREE.PointLight('#fff', 2);
	light2.position.x = 5;
	light2.position.y = 5;
	light2.position.z = 1;
	scene.add(light2);

	const star_material = new THREE.MeshBasicMaterial( { side: THREE.DoubleSide, color: 0xaaaaaa } );
	let stars = [];

	for (let i = 0; i < 200; i++) {
		const star_geometry = new THREE.CircleGeometry( Math.random() * 200 + 100, 8 );
		const star_circle = new THREE.Mesh( star_geometry, star_material );
		scene.add(star_circle);
		//star_circle.rotation.y = Math.PI / 2;
		const u = Math.random() - 0.5;
		const v = Math.random() - 0.5;
		const w = Math.random() - 0.5;
		star_circle.position.set(-100000*Math.sin(v*Math.PI+Math.PI/2), 300000*u, 100000*Math.cos(v*Math.PI+Math.PI/2));
		star_circle.lookAt(camera.position);
		stars.push(star_circle);
	}


	let ships = [];
	let bolts = [];

	window.addEventListener('resize', () => {
		camera.updateProjectionMatrix();
		renderer.setSize(ref.current.clientWidth, ref.current.clientHeight);
	});

	ref.current.addEventListener('mousemove', (e) => {
		const x = e.clientX;
		const ratio = x / ref.current.clientWidth;
		camera.position.set(5, 2, ratio * 4 - 2);
		camera.lookAt(new THREE.Vector3(0, 0, 0));
	});

	const animate = () => {
		const deltaTime = 0.075;
		t += deltaTime;

		const direction = Math.random() > 0.5 ? 1 : -1;

		if (t > nextShip) {
			const ship = new Ship(direction);
			scene.add(ship.mesh);
			ships.push(ship);
			nextShip += shipInterval + (Math.random() - 0.5) * 2;
		}

		for (const ship of ships) {
			ship.update({ deltaTime });

			if (ship.firing) {
				const bolt = new Laser(ship);

				bolts.push(bolt);
				scene.add(bolt.mesh);
				ship.firing = false;
			}

			if (ship.kill) {
				scene.remove(ship.mesh);
			}
		}

		for (const bolt of bolts) {
			bolt.update({ deltaTime });

			if (bolt.kill) {
				scene.remove(bolt.mesh);
			}
		}

		ships = ships.filter((s) => !s.kill);
		bolts = bolts.filter((s) => !s.kill);

		requestAnimationFrame(animate);
		renderer.render(scene, camera);
	};

	animate();

	renderer.render(scene, camera);
};
