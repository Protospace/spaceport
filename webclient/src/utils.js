var siteUrl, apiUrl;

if (process.env.NODE_ENV !== 'production') {
	siteUrl = 'http://spaceport.dns.t0.vc';
	apiUrl = 'http://spaceport-api.dns.t0.vc';
} else {
	siteUrl = 'https://' + window.location.hostname;
	apiUrl = 'https://api.' + window.location.hostname;
}

export const requester = (route, method, data) => {
	var options;

	if (method == 'GET') {
		options = {};
	} else if (method == 'POST') {
		const formData = new FormData();
		Object.keys(data).forEach(key =>
			formData.append(key, data[key])
		);

		options = {
			method: 'POST',
			body: formData,
		};
	} else {
		return 'Method not supported';
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
		} else if (code == 400) {
			return error.data.json()
			.then(result => {
				throw customError(result);
			});
		} else {
			throw customError({non_field_errors: ['Network Error']});
		}
	});
}
