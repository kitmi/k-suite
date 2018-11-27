const { Promise } = require('rk-utils');

function validateAction(action) {
	if (Array.isArray(action)) {
		action.forEach(r => validateAction(r));
		return;
	}

	if (typeof action !== 'function') {
		throw new Error('Invalid action(s): ' + JSON.stringify(action));
	}
}

function composeActions(actions) {
	return function (facts, next) {
		let index = -1;
		return dispatch(0);

		function dispatch(i) {
			if (i <= index) return Promise.reject(new Error('next() called multiple times'));

			index = i;

			let fn = i === actions.length ? next : actions[i];
			if (!fn) return Promise.resolve();

			try {
				return Promise.resolve(fn(facts, dispatch.bind(null, i + 1)));
			} catch (err) {
				return Promise.reject(err)
			}
		}
	}
}

exports.validateAction = validateAction;
exports.composeActions = composeActions;