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

	const renderer = new THREE.WebGLRenderer({ antialias: true });

	const width = ref.current.clientWidth;
	const height = ref.current.clientHeight;

	renderer.setSize(width, height);

	const camera = new THREE.PerspectiveCamera(65, width / height, 0.01, 1000);

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

	let ships = [];
	let bolts = [];

	window.addEventListener('resize', () => {
		camera.updateProjectionMatrix();
		renderer.setSize(ref.current.clientWidth, ref.current.clientHeight);
	});

	const animate = () => {
		const deltaTime = 0.075;
		t += deltaTime;

		// register mouse event for 'onmove'
		// get mouse x & y
		// const mu = mousex / ref.width
		// const mv = mousey / ref.heigh

		// camera.x = sin(mu * Math.PI * 2)
		// camera.z = cos(mu * Math.PI * 2)
		//

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
				console.log(bolt.mesh.position);
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
