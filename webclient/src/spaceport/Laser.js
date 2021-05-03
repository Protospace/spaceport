import * as THREE from 'three';

const LASER_SIZE = 0.5;
const BULLET_SPREAD = 0.1;

const geometry = new THREE.BoxGeometry(
	LASER_SIZE * 0.3,
	LASER_SIZE * 0.3,
	LASER_SIZE
);

const badLaserMat = new THREE.MeshStandardMaterial(0xffffff, {
	flatShading: true,
	color: new THREE.Color(`hsl(0,100%,70%)`),
});

const goodLaserMat = new THREE.MeshStandardMaterial(0xffffff, {
	flatShading: true,
	color: new THREE.Color(`hsl(180,100%,70%)`),
});

export class Laser {
	constructor(ship, count) {
		const position = new THREE.Vector3();
		this.direction = ship.direction;
		this.kill = false;
		this.life = 20;

		this.stepX = (Math.random() - 0.5) * BULLET_SPREAD;
		this.stepY = (Math.random() - 0.5) * BULLET_SPREAD;

		ship.mesh.getWorldPosition(position);

		this.mesh = new THREE.InstancedMesh(geometry, badLaserMat, count);

		this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

		this.mesh.position.set(position.x, position.y, position.z);
	}

	update({ deltaTime }) {
		this.mesh.position.x += this.stepX;
		this.mesh.position.y += this.stepY;
		this.mesh.position.z += 0.5 * this.direction;
		this.life -= deltaTime;

		if (this.life < 0) this.kill = true;
	}
}
