import Definitions from './definitions';

export default {
	sluggify: (title) => {
		return title.replace(/\s+/g, '-');
	},

	/**
		@param payload {Object}
		@param name {String}
		@throws Error if validation fails
		@returns true if validation succeeds
	*/
	validate: (payload, name) => {
		const definition = definitions[name];
		const missing = [];
		const badType = [];
		Object.keys(definition).forEach((key) => {
			if (definition[key].required) {
				const type = typeof payload[key];
				if (type === 'undefined') {
					missing.push(key);
				} else if (type !== definition[key].type) {
					badType.push(key);
				}
			}
		});

		if (missing.length > 0 || badType.length > 0) {
			// TODO nicely format this (_formatError)
			throw new Error(`Validation failed for ${name}:\n
				The following options were missing: ${missing}\n
				The folling options had bad types: ${badTypes}`);
		}
		return true;
	}
};
