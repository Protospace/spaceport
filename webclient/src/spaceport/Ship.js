import * as THREE from 'three';

const SHIP_SIZE = 1;

const geometry = new THREE.BoxGeometry(
	SHIP_SIZE * 0.1,
	SHIP_SIZE * 0.1,
	SHIP_SIZE
);

const burstGeo = new THREE.SphereGeometry(0.1, 32, 32);

export class Ship {
	constructor(direction) {
		this.direction = direction;
		this.life = Math.random() * 5 + 12;
		this.nextShot = 3;
		this.shotInterval = 3;
		this.flyIn = true;
		this.firing = false;
		this.exploded = false;

		const material = new THREE.MeshStandardMaterial(0xffffff, {
			flatShading: true,
		});

		this.mesh = new THREE.Mesh(geometry, material);

		this.y = (Math.random() - 0.5) * 4;
		this.x = (Math.random() - 0.5) * 4;

		this.mesh.material.color.set(
			new THREE.Color(`hsl(${direction > 0 ? 0 : 180},30%,40%)`)
		);
		this.mesh.material.opacity = 1;

		this.mesh.position.y = this.y;
		this.mesh.position.x = this.x;
		this.mesh.position.z = (-475 / 4 - 6) * this.direction; //+ Math.random()
	}

	update({ deltaTime }) {
		if (this.flyIn) {
			this.mesh.scale.z = 10;
			this.mesh.position.z += 4.75 * this.direction;

			if (Math.abs(this.mesh.position.z) <= 6 && this.flyIn) {
				this.flyIn = false;
				this.mesh.scale.z = 0.5;
			}
		} else {
			this.mesh.scale.z = 0.5;
		}

		this.life -= deltaTime;

		if (!this.flyIn) {
			this.mesh.material.color.set(
				new THREE.Color(`hsl(${this.direction > 0 ? 0 : 180},30%,20%)`)
			);

			const xs = Math.sin(this.life * 0.5 + this.x);
			const yrot = Math.sin(
				this.life + this.x + (3.14 / 2) * this.direction
			);
			this.mesh.position.y = this.y + Math.sin(this.life + this.y) * 0.1;
			this.mesh.position.x = this.x + xs * 0.15;
			this.mesh.rotation.x = yrot * 0.05;
			this.mesh.position.z += 0.01 * this.direction;
			this.nextShot -= deltaTime;
			if (this.nextShot <= 0) {
				this.firing = true;
				this.nextShot = this.shotInterval;
			}
		}

		if (this.life < 0 && !this.flyin && !this.exploded) {
			this.mesh.geometry = burstGeo;
			this.mesh.material.transparent = true;
			this.mesh.material.opacity *= 0.95;
			this.exploded = true;
			this.mesh.scale.x = 1;
			this.mesh.scale.y = 1;
			this.mesh.scale.z = 1;
		}

		if (this.exploded) {
			this.mesh.scale.x *= 1.1;
			this.mesh.scale.y *= 1.1;
			this.mesh.scale.z *= 1.1;
		}

		if (this.mesh.scale.x > 10) {
			this.kill = true;
		}
	}
}
