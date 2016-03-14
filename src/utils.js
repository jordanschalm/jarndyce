import Definitions from './definitions';
import FS from 'fs';

function _formatError(name, missing, badType) {
	let errorString = `Validation failed for ${name}`;
	if (missing && missing.length) {
		for (let i in missing) {
			errorString = errorString + `\nMissing required key ${missing[i]}.`;
		}
	}
	if (badType && badType.length) {
		for (let i in badType) {
			const bt = badType[i];
			errorString = errorString + `\nIncorrect type for key ${bt.key}. `
				+ `Was ${bt.type}, expected ${bt.expectedType}.`;
		}
	}
	return errorString;
}

export default {
	getSecretKey: () => {
		return process.env.JARNDYCE_SECRET_KEY
			|| FS.readFileSync('.JARNDYCE_SECRET_KEY', 'utf8').split('\n')[0];
	},

	sluggify: (title) => {
		return title.replace(/\s+/g, '-').toLowerCase();
	},

	/**
		@param payload {Object}
		@param name {String}
		@throws Error if validation fails
		@returns true if validation succeeds
	*/
	validate: (payload, name) => {
		const definition = Definitions[name];
		const missing = [];
		const badType = [];

		Object.keys(definition).forEach((key) => {
			const type = typeof payload[key];
			const expectedType = definition[key].type;
			if (definition[key].required) {
				if (type === 'undefined') {
					missing.push(key);
				} else if (expectedType && type !== expectedType) {
					badType.push({key, type, expectedType});
				}
			} else if (type === 'undefined') {
				payload[key] = definition[key].default;
			}
		});

		if (missing.length > 0 || badType.length > 0) {
			throw new Error(_formatError(name, missing, badType));
		}
		return payload;
	}
};
