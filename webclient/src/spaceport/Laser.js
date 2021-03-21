import * as THREE from 'three';

const LASER_SIZE = 0.5;

export class Laser {
	constructor(ship) {
		const position = new THREE.Vector3();
		this.direction = ship.direction;

		ship.mesh.getWorldPosition(position)

		const shipGeo = new THREE.BoxGeometry(
			LASER_SIZE * 0.03,
			LASER_SIZE * 0.03,
			LASER_SIZE
		);
		this.mesh = new THREE.Mesh(
			shipGeo,
			new THREE.MeshStandardMaterial(this.direction > 0 ? 0xff0000 : 0x0000ff, { flatShading: true })
		);

		this.mesh.material.color.set(
			new THREE.Color(`hsl(${ship.direction > 0 ? 0 : 180},100%,70%)`)
		);

		this.mesh.position.set(position.x, position.y, position.z);
	}

	update({ deltaTime }) {
		this.mesh.position.z += 0.5 * this.direction;
	}
}
