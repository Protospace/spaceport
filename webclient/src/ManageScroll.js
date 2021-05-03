import { useEffect } from 'react';
import { useHistory } from 'react-router-dom';

let scrollPositions = {};
let timeout = null;

export function ManageScroll() {
	const history = useHistory();

	const scrollListener = () => {
		if (timeout) {
			window.cancelAnimationFrame(timeout);
		}

		timeout = window.requestAnimationFrame(() => {
			const key = history.location.key;
			if (key in scrollPositions) {
				scrollPositions[key] = window.scrollY;
			}
		});
	};

	useEffect(() => {
		window.addEventListener('scroll', scrollListener);
		return () => {
			window.removeEventListener('scroll', scrollListener);
		};
	}, []);

	useEffect(() => {
		const key = history.location.key;

		if (key in scrollPositions) {
			window.scrollTo(0, scrollPositions[key]);
		} else {
			window.scrollTo(0, 0);
			scrollPositions[key] = 0;
		}
	}, [history.location]);

	return null;
}
