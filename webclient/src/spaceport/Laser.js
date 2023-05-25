import * as THREE from 'three';

const LASER_SIZE = 0.5;

const geometry = new THREE.BoxGeometry(
	LASER_SIZE * 0.03,
	LASER_SIZE * 0.03,
	LASER_SIZE
);

const material = new THREE.MeshStandardMaterial(0xffffff, {
	flatShading: true,
});

export class Laser {
	constructor(ship) {
		const position = new THREE.Vector3();
		this.direction = ship.direction;
		this.kill = false;

		ship.mesh.getWorldPosition(position);

		const shipGeo = geometry;
		this.mesh = new THREE.Mesh(shipGeo, material);

		this.mesh.material.color.set(
			new THREE.Color(`hsl(${ship.direction > 0 ? 0 : 180},100%,70%)`)
		);

		this.mesh.position.set(position.x, position.y, position.z);
	}

	update({ deltaTime }) {
		this.mesh.position.z += 0.5 * this.direction;

		if (Math.abs(this.mesh.position.z > 475/2)) {
			this.kill = true;
		}
	}
}
