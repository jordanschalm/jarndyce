import Express from 'express';

export default {
	addOptions: {
		body: {
			required: true,
			type: 'string'
		},
		created: {
			required: false,
			type: 'string'
		},
		format: {
			required: false,
			type: 'string'
		},
		slug: {
			required: false,
			type: 'string'
		},
		title: {
			required: true,
			type: 'string'
		}
	},
	initOptions: {
		app: {
			required: true,
			type: 'object'
		},
		mongoUri: {
			default: 'mongodb://localhost/jarndyce',
			type: 'string'
		}
	}
}
