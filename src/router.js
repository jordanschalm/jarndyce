import {add, remove} from './core';
import Express from 'express';

const Router = Express.Router();

// needs access to add, remove methods
// pass in with req object?
Router.post('/', (req, res) => {
	// TODO authentication :)

	try {
		const doc = add(payload);
		res.send(doc);
	} catch (err) {
		res.send(err);
	}
});


export default Router;
