import * as THREE from 'three';

const SHIP_SIZE = 1;
const geometry = new THREE.BoxGeometry(
	SHIP_SIZE * 0.1,
	SHIP_SIZE * 0.1,
	SHIP_SIZE
);
const material = new THREE.MeshStandardMaterial(0xffffff, {
	flatShading: true,
});

export class Ship {
	constructor(direction) {
		this.direction = direction;
		this.life = Math.random() * 5 + 12;
		this.nextShot = 3;
		this.shotInterval = 3;
		this.flyIn = true;
		this.firing = false;

		const shipGeo = geometry;
		this.mesh = new THREE.Mesh(shipGeo, material);
		this.y = (Math.random() - 0.5) * 2;
		this.x = (Math.random() - 0.5) * 2;

		this.mesh.material.color.set(
			new THREE.Color(`hsl(${direction > 0 ? 0 : 180},30%,40%)`)
		);
		this.mesh.position.y = this.y;
		this.mesh.position.x = this.x;
		this.mesh.position.z = (-475 / 4 - 6) * this.direction; //+ Math.random()
	}

	update({ deltaTime }) {
		if (this.flyIn) {
			this.mesh.scale.z = 10;
			this.mesh.position.z += 4.75 * this.direction;

			// ship accelerating decreasing
			// check if in space
			if (Math.abs(this.mesh.position.z) <= 6 && this.flyIn) {
				this.flyIn = false;
				this.mesh.scale.z = 0.5;
				//this.mesh.material.color.set(
				//	new THREE.Color(`hsl(${this.hue},0%,30%)`)
				//);
			}
		} else {
			this.mesh.scale.z = 0.5;
		}

		this.life -= deltaTime;

		if (!this.flyIn) {
			const xs = Math.sin(this.life * 0.5 + this.x);
			this.mesh.position.y = this.y + Math.sin(this.life + this.y) * 0.08;
			this.mesh.position.x = this.x + xs * 0.08;
			this.mesh.rotation.y = xs * 0.25;
			this.mesh.position.z += 0.01 * this.direction;
			this.nextShot -= deltaTime;
			if (this.nextShot <= 0) {
				this.firing = true;
				this.nextShot = this.shotInterval;
			}
		}

		if (this.life < 0) {
			const a = Math.abs(this.life);
			this.mesh.position.z += a * 2 * this.direction;
			this.mesh.scale.z = a * 4;
			this.firing = false;
		}

		if (Math.abs(this.mesh.position.z > 475 / 2)) {
			this.kill = true;
		}
	}
}
