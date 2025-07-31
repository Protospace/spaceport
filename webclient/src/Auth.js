import React, { useState, useEffect, useRef } from 'react';
import { Route, Link, useLocation } from 'react-router-dom';
import * as THREE from 'three';
import './light.css';
import { Container, Form, Header, Image, Message, Segment } from 'semantic-ui-react';
import { requester } from './utils.js';

export function AuthForm(props) {
	const { user } = props;
	const username = user ? user.username : '';
	const [input, setInput] = useState({ username: username });
	const [error, setError] = useState({});
	const [success, setSuccess] = useState(false);
	const [loading, setLoading] = useState(false);

	const handleValues = (e, v) => setInput({ ...input, [v.name]: v.value });
	const handleChange = (e) => handleValues(e, e.currentTarget);

	const handleSubmit = (e) => {
		if (input.username.includes('@')) {
			setError({ username: 'Spaceport username, not email.' });
		} else {
			if (loading) return;
			setLoading(true);
			const data = { ...input, username: input.username.toLowerCase() };
			requester('/spaceport-auth/login/', 'POST', '', data)
			.then(res => {
				setSuccess(true);
				setError({});
			})
			.catch(err => {
				setLoading(false);
				console.log(err);
				setError(err.data);
			});
		}
	};

	return (
		success ?
			props.children
		:
			<Form
				onSubmit={handleSubmit}
				warning={error.non_field_errors && error.non_field_errors[0] === 'Unable to log in with provided credentials.'}
			>
				<Header size='medium'>Log In to Spaceport</Header>

				{user ?
					<><Form.Input
						label='Spaceport Username'
						name='username'
						value={user.username}
						onChange={handleChange}
						error={error.username}
					/>
					<Form.Input
						label='Spaceport Password'
						name='password'
						type='password'
						onChange={handleChange}
						error={error.password}
						autoFocus
					/></>
				:
					<><Form.Input
						label='Spaceport Username'
						name='username'
						placeholder='first.last'
						onChange={handleChange}
						error={error.username}
						autoFocus
					/>
					<Form.Input
						label='Spaceport Password'
						name='password'
						type='password'
						onChange={handleChange}
						error={error.password}
					/></>
				}

				<Form.Button loading={loading} error={error.non_field_errors}>
					Authorize
				</Form.Button>

				<Message warning>
					<Message.Header>Forgot your password?</Message.Header>
					<p><Link to='/password/reset/'>Click here</Link> to reset it.</p>
				</Message>
			</Form>
	);
};

export function AuthWiki(props) {
	const { user } = props;

	return (
		<Segment compact padded>
			<Header size='medium'>
				<Image src={'/wikilogo.png'} />
				Protospace Wiki
			</Header>

			<p>would like to request Spaceport authentication.</p>

			<p>URL: <a href='https://wiki.protospace.ca/Welcome_to_Protospace' target='_blank' rel='noopener noreferrer'>wiki.protospace.ca</a></p>

			<AuthForm user={user}>
				<Header size='small'>Success!</Header>
				<p>You can now log into the Wiki:</p>
				{user && <p>
					Username: {user.member.mediawiki_username || user.username}<br/>
					Password: [this Spaceport password]
				</p>}
				<p><a href='https://wiki.protospace.ca/index.php?title=Special:UserLogin&returnto=Welcome+to+Protospace' rel='noopener noreferrer'>Protospace Wiki</a></p>
			</AuthForm>
		</Segment>
	);
}

export function AuthDiscourse(props) {
	const { user } = props;

	return (
		<Segment compact padded>
			<Header size='medium'>
				<Image src={'/discourselogo.png'} />
				Protospace Discourse
			</Header>

			<p>would like to request Spaceport authentication.</p>

			<p>URL: <a href='https://forum.protospace.ca' target='_blank' rel='noopener noreferrer'>forum.protospace.ca</a></p>

			<AuthForm user={user}>
				<Header size='small'>Success!</Header>
				<p>You can now log into the Discourse:</p>
				{user && <p>
					Username: {user.member.discourse_username || user.username}<br/>
					Password: [this Spaceport password]
				</p>}
				<p><a href='https://forum.protospace.ca' rel='noopener noreferrer'>Protospace Discourse</a></p>
			</AuthForm>
		</Segment>
	);
}

export function AuthOIDC(props) {
	const { token, user } = props;
	const [error, setError] = useState(false);
	const qs = decodeURIComponent(useLocation().search.replace('?next=/openid/authorize', ''));
	const mountRef = useRef(null);

	useEffect(() => {
		requester('/oidc/' + qs, 'GET', token)
		.then(res => {
			setError(false);
			window.location = res.url;
		})
		.catch(err => {
			setError(true);
			console.log(err);
		});
	}, []);

	useEffect(() => {
		const mount = mountRef.current;
		if (!mount) return;

		const scene = new THREE.Scene();

		const camera = new THREE.PerspectiveCamera(75, mount.clientWidth / mount.clientHeight, 0.1, 1000);
		camera.position.z = 50;

		const vFOV = THREE.MathUtils.degToRad(camera.fov);
		const height = 2 * Math.tan(vFOV / 2) * camera.position.z;
		const width = height * camera.aspect;

		const webglSupport = (() => {
			try {
				const canvas = document.createElement('canvas');
				return !!(window.WebGLRenderingContext && (canvas.getContext('webgl') || canvas.getContext('experimental-webgl')));
			} catch (e) {
				return false;
			}
		})();

		if (!webglSupport) {
			return;
		}

		const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
		renderer.setSize(mount.clientWidth, mount.clientHeight);
		mount.appendChild(renderer.domElement);

		const rockets = [];
		const rocketMaterial = new THREE.MeshBasicMaterial({ color: 0x606060 });

		const createRocket = () => {
			const rocketGroup = new THREE.Group();

			// Cone (engine)
			const coneGeometry = new THREE.ConeGeometry(1, 2, 8);
			const cone = new THREE.Mesh(coneGeometry, rocketMaterial);
			cone.position.y = 1;
			rocketGroup.add(cone);

			// Cylinder (body)
			const cylinderGeometry = new THREE.CylinderGeometry(1, 1, 4, 8);
			const cylinder = new THREE.Mesh(cylinderGeometry, rocketMaterial);
			cylinder.position.y = 4;
			rocketGroup.add(cylinder);

			// Hemisphere (tip)
			const tipGeometry = new THREE.SphereGeometry(1, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2);
			const tip = new THREE.Mesh(tipGeometry, rocketMaterial);
			tip.position.y = 6;
			rocketGroup.add(tip);

			// Flame
			const flameMaterial = new THREE.MeshBasicMaterial({ color: 0xffa500 });
			const flameGeometry = new THREE.ConeGeometry(0.8, 3, 8);
			const flame = new THREE.Mesh(flameGeometry, flameMaterial);
			flame.position.y = -1.5;
			rocketGroup.add(flame);
			rocketGroup.userData.flame = flame;

			return rocketGroup;
		};

		const numRockets = 5;
		const xRange = width * 0.9;
		for (let i = 0; i < numRockets; i++) {
			const rocket = createRocket();
			const xPos = (i / (numRockets - 1) - 0.5) * xRange;
			rocket.position.x = xPos;
			rocket.position.y = -height / 2;
			scene.add(rocket);
			const velocity = 0;
			const acceleration = 0.01 + (i / (numRockets - 1)) * 0.03;
			rockets.push({mesh: rocket, velocity: velocity, acceleration: acceleration});
		}

		let t = 0;
		let animationFrameId;
		const animate = () => {
			animationFrameId = requestAnimationFrame(animate);
			t += 0.2;

			rockets.forEach(r => {
				r.velocity += r.acceleration;
				r.mesh.position.y += r.velocity;

				// Animate flame
				const flame = r.mesh.userData.flame;
				if (flame) {
					flame.scale.y = 1 + Math.sin(t + r.mesh.id) * 0.4;
					flame.scale.x = 1 + Math.cos(t + r.mesh.id) * 0.2;
				}
			});

			renderer.render(scene, camera);
		};
		animate();

		const handleResize = () => {
			if (mount) {
				camera.aspect = mount.clientWidth / mount.clientHeight;
				camera.updateProjectionMatrix();
				renderer.setSize(mount.clientWidth, mount.clientHeight);
			}
		};
		window.addEventListener('resize', handleResize);

		return () => {
			window.removeEventListener('resize', handleResize);
			cancelAnimationFrame(animationFrameId);
			if (mount && renderer.domElement) {
				mount.removeChild(renderer.domElement);
			}
		};
	}, []);

	return (
		<>
			<div ref={mountRef} style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%' }} />
			<Container style={{ position: 'relative' }}>
				<Header size='large'>Spaceport Auth</Header>

				<Segment compact padded>
					<p>Authorizing OIDC...</p>

					{error && <p>Error, are you logged in?</p>}
				</Segment>
			</Container>
		</>
	);
}

export function Auth(props) {
	const { token, user } = props;

	return (
		<Container>
			<Header size='large'>Spaceport Auth</Header>

			<p>Use this page to link different applications to your Spaceport account.</p>

			<Message warning>
				<Message.Header>Only need to do this once</Message.Header>
				<p>Note: you should only ever need to do this once if you are an old returning member. Otherwise, just sign into each app with your Spaceport login.</p>
			</Message>

			<Route path='/auth/wiki'>
				<AuthWiki user={user} />
			</Route>

			<Route path='/auth/discourse'>
				<AuthDiscourse user={user} />
			</Route>
		</Container>
	);
}
