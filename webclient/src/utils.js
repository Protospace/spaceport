export const siteUrl = window.location.protocol + '//' + window.location.hostname;
export const apiUrl = window.location.protocol + '//api.' + window.location.hostname;
export const staticUrl = window.location.protocol + '//static.' + window.location.hostname;

export const requester = (route, method, token, data) => {
	let options = {headers: {}};

	if (token) {
		options.headers.Authorization = 'Token ' + token;
	}

	if (method == 'GET') {
		// pass
	} else if (['POST', 'PUT', 'PATCH'].includes(method)) {
		const formData = new FormData();
		Object.keys(data).forEach(key =>
			formData.append(key, data[key])
		);

		options = {
			...options,
			method: method,
			body: formData,
		};
	} else {
		throw new Error('Method not supported');
	}

	const customError = (data) => {
		const error = new Error(JSON.stringify(data));
		error.data = data;
		return error;
	}

	return fetch(apiUrl + route, options)
	.then(response => {
		if (!response.ok) {
			throw customError(response);
		}
		return response.json();
	})
	.catch(error => {
		const code = error.data.status;
		if (code == 413) {
			throw customError({non_field_errors: ['File too big']});
		} else if (code >= 400 && code < 500) {
			return error.data.json()
			.then(result => {
				throw customError(result);
			});
		} else if (code >= 500 && code < 600) {
			throw customError({non_field_errors: ['Server Error']});
		} else {
			throw customError({non_field_errors: ['Network Error']});
		}
	});
}
