import * as THREE from 'three';

const SHIP_SIZE = 1;

export class Ship {
	constructor() {
		this.life = Math.random() * 5 + 3;
		this.flyIn = true;

		const shipGeo = new THREE.BoxGeometry(
			SHIP_SIZE * 0.3,
			SHIP_SIZE * 0.3,
			SHIP_SIZE
		);
		this.mesh = new THREE.Mesh(
			shipGeo,
			new THREE.MeshBasicMaterial(0xff0000)
		);
		this.y = (Math.random() - 0.5) * 2;

		this.hue = Math.floor(Math.random() * 360);

		this.mesh.material.color.set(
			new THREE.Color(`hsl(${this.hue},70%,80%)`)
		);
		this.mesh.position.x = (Math.random() - 0.5) * 2;
		this.mesh.position.y = this.y;
		this.mesh.position.z = -105 + Math.random();
	}

	update({ deltaTime }) {
		if (this.flyIn) {
			this.mesh.scale.z = 10;
			this.mesh.position.z += 4.75;

			// ship accelerating decreasing
			// checvk if in space
			if (this.mesh.position.z > -1 && this.flyIn) {
				this.flyIn = false;
				this.mesh.scale.z = 0.5;
				this.mesh.material.color.set(
					new THREE.Color(`hsl(${this.hue},70%,100%)`)
				);
			}
		} else {
			this.mesh.scale.z = 0.5;
		}

		this.life -= deltaTime;

		this.mesh.position.y = this.y + Math.sin(this.life + this.y) * 0.02;

		if (this.life < 0) {
			const a = Math.abs(this.life);
			this.mesh.position.z += a * 2;
			this.mesh.scale.z = a * 4;

			// accelerate away
		}

		if (this.mesh.position.z > 5) {
			this.kill = true;
		}
	}
}
