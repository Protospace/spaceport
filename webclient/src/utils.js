import React, { useState, useEffect } from 'react';
import { Table } from 'semantic-ui-react';

export const randomString = () => Math.random().toString(36).substr(2, 10);

export const siteUrl = window.location.toString();
export const apiUrl = window.location.port ?
	'http://' + window.location.hostname + ':8000'
:
	window.location.protocol + '//api.' + window.location.hostname;
export const staticUrl = window.location.port ?
	'http://' + window.location.hostname + ':8000/static'
:
	window.location.protocol + '//static.' + window.location.hostname;

export const isAdmin = (user) => user.is_staff || user.member.is_director || user.member.is_staff;
export const isInstructor = (user) => isAdmin(user) || user.member.is_instructor;

export const getInstructor = (x) => {
	if (x.course === 413 || x.course === 317 || x.course === 273) {
		return 'Protospace';
	} else {
		return x.instructor_name;
	}
};

export const statusColor = {
	'Prepaid': 'green',
	'Current': 'green',
	'Due': 'yellow',
	'Overdue': 'red',
	'Former Member': 'black',
};

export const BasicTable = (props) => (
	<Table collapsing padded unstackable basic='very'>
		{props.children}
	</Table>
);

export const requester = (route, method, token, data, signal=null) => {
	let options = {headers: {}, signal: signal};
	let url = '';

	if (token) {
		options.headers.Authorization = 'Token ' + token;
	}

	if (method === 'GET') {
		// pass
	} else if (['POST', 'PUT', 'PATCH'].includes(method)) {
		const formData = new FormData();
		Object.keys(data).forEach(key =>
			formData.append(key, data[key] === null ? '' : data[key])
		);

		options = {
			...options,
			method: method,
			body: formData,
		};
	} else if (method === 'DELETE') {
		options = {
			...options,
			method: method,
		};
	} else {
		throw new Error('Method not supported');
	}

	const customError = (data) => {
		const error = new Error(JSON.stringify(data));
		error.data = data;
		return error;
	}

	if (route.startsWith('http')) {
		url = route;
	} else {
		url = apiUrl + route;
	}

	return fetch(url, options)
	.then(response => {
		if (!response.ok) {
			throw customError(response);
		}

		if (method === 'DELETE') {
			return {};
		}

		const contentType = response.headers.get('content-type');
		if (contentType && contentType.indexOf('application/json') !== -1) {
			return response.json();
		} else {
			return response;
		}
	})
	.catch(error => {
		const code = error.data ? error.data.status : null;
		if (code === 413) {
			throw customError({non_field_errors: ['File too big']});
		} else if (code >= 400 && code < 500) {
			return error.data.json()
			.then(result => {
				if (result.detail === 'Invalid token.') {
					localStorage.clear();
					window.location = '/';
				}
				throw customError(result);
			});
		} else if (code >= 500 && code < 600) {
			throw customError({non_field_errors: ['Server Error']});
		} else if (error.message === 'The operation was aborted. ') {
			throw error;
		} else {
			throw customError({non_field_errors: ['Network Error']});
		}
	});
}

// from: https://usehooks.com/useWindowSize/
function useWindowSize() {
	const [windowSize, setWindowSize] = useState({
		width: undefined,
		height: undefined,
	});

	useEffect(() => {
		function handleResize() {
			setWindowSize({
				width: window.innerWidth,
				height: window.innerHeight,
			});
		}
		window.addEventListener('resize', handleResize);
		handleResize();
		return () => window.removeEventListener('resize', handleResize);
	}, []);

	return windowSize;
}

export const useIsMobile = () => {
	const {width} = useWindowSize();
	return width <= 767;
}
