import init from './core/init';
// import add from './core/add';
// import remove from './core/remove';
// import get from './core/get';
// import set from './core/set';

class Jarndyce {
	constructor () {
		this.init = init;
		// 
		// this.add = add;
		// this.remove = remove;
		//
		// this.get = get;
		// this.set = set;
	}
}

exports = module.exports = new Jarndyce();
