import * as THREE from 'three';

const LASER_SIZE = 0.5;
const BULLET_SPREAD = 0.1;

const geometry = new THREE.BoxGeometry(
	LASER_SIZE * 0.03,
	LASER_SIZE * 0.03,
	LASER_SIZE
);

const material = new THREE.MeshStandardMaterial(this.direction > 0 ? 0xff0000 : 0x0000ff, { flatShading: true })

export class Laser {
	constructor(ship) {
		const position = new THREE.Vector3();
		this.direction = ship.direction;
		this.kill = false;

		this.stepX = (Math.random()-0.5) * BULLET_SPREAD;
		this.stepY = (Math.random()-0.5) * BULLET_SPREAD;

		ship.mesh.getWorldPosition(position)

		this.mesh = new THREE.Mesh(
			geometery,
			material
		);

		this.mesh.material.color.set(
			new THREE.Color(`hsl(${ship.direction > 0 ? 0 : 180},100%,70%)`)
		);

		this.mesh.position.set(position.x, position.y, position.z);
	}

	update({ deltaTime }) {
		this.mesh.position.x += this.stepX;
		this.mesh.position.y += this.stepY;
		this.mesh.position.z += 0.5 * this.direction;

		if (Math.abs(this.mesh.position.z > 475/2)) {
			this.kill = true;
		}
	}
}
