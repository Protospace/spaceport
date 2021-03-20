import * as THREE from 'three/build/three.module';
import { Ship } from './Ship';

export const scene = ({ ref }) => {
	// TODO: add waves of ships
	// TODO: add stars
	// TODO: use aspect ratio to determine space docking point

	let t = 0.01;
	const shipInterval = 2;
	let nextShip = shipInterval;

	var scene = new THREE.Scene();

	const renderer = new THREE.WebGLRenderer({ antialias: true });

	const width = ref.current.clientWidth;
	const height = ref.current.clientHeight;

	renderer.setSize(width, height);

	const camera = new THREE.PerspectiveCamera(65, width / height, 0.01, 1000);

	camera.position.set(3, 0.5, 5);
	camera.lookAt(new THREE.Vector3(-9, 0, 3));
	scene.add(camera);

	ref.current.appendChild(renderer.domElement);

	const light = new THREE.DirectionalLight('#fff', 1);
	light.position.x = 3;
	light.position.z = 1;
	scene.add(light);

	var sphere = new THREE.SphereBufferGeometry(1);
	var object = new THREE.Mesh(
		sphere,
		new THREE.MeshStandardMaterial(0xff0000, { flatShading: true })
	);
	var boxHelp = new THREE.BoxHelper(object, 0xffff00);
	// scene.add(boxHelp);

	let ships = [];
	const ship = new Ship();
	scene.add(ship.mesh);
	ships.push(ship);

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

		if (t > nextShip) {
			const ship = new Ship();
			scene.add(ship.mesh);
			ships.push(ship);
			nextShip += shipInterval + (Math.random() - 0.5) * 2;
		}

		for (const ship of ships) {
			ship.update({ deltaTime });
			if (ship.kill) {
				scene.remove(ship.mesh);
			}
		}

		ships = ships.filter((s) => !s.kill);

		requestAnimationFrame(animate);
		renderer.render(scene, camera);
	};

	animate();

	renderer.render(scene, camera);
};
