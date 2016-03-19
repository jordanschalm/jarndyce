import BodyParser from 'body-parser';
import Crypto from 'crypto-js';
import Express from 'express';
import Utils from './utils';

const Router = Express.Router();
const SECRET_KEY = Utils.getSecretKey();

/**
	@method _validateSignature - middleware to validate
		AES signature for secure router methods
	@param {Express.Request} req
	@param {Express.Response} res
	@param {Function} next
**/
function _validateSignature(req, res, next) {
	const signature = req.get('Signature');
	if (!signature) {
		res.status('401').send('Validation failed');
	} else {
		const decrypted = Crypto.AES.decrypt(signature, SECRET_KEY).toString(Crypto.enc.Utf8);

		if (decrypted !== JSON.stringify(req.body)) {
			res.status('401').send('Validation failed.');
		} else {
			next();
		}
	}
}

function _send404(req, res) {
	res.status('404').send('Resource not found.');
}

export default function (Jarndyce) {
	Router.use(BodyParser.json());

	Router.get('/:slug', (req, res) => {
		const {slug} = req.params;
		Jarndyce.get(slug)
			.then((doc) => {
				if (!doc) {
					_send404(res);
				} else {
					res.status('200').send(doc);
				}
			}, (err) => {
				res.status('400').send(err);
			});
	});

	Router.post('/', _validateSignature, (req, res) => {
		const payload = req.body;
		Jarndyce.add(payload)
			.then((doc) => {
				res.status('201').send(doc);
			}, (err) => {
				res.status('400').send(err);
			});
	});

	Router.delete('/:slug', _validateSignature, (req, res) => {
		const {slug} = req.params;
		Jarndyce.remove(slug)
			.then((doc) => {
				res.status('200').send(doc);
			}, (err) => {
				if (!doc) {
					_send404(res);
				} else {
					res.status('400').send(err);
				}
			});
	});

	return Router;
}
