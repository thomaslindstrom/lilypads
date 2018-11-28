const isNumber = require('@amphibian/is-number');
const createCache = require('@amphibian/cache');
const parties = require('@amphibian/party');

const CACHE_LIFETIME = 6 * 60 * 60 * 1000; // 6 hours
const lilypadsCache = createCache();

class ForceThrowError extends Error {
	constructor(message) {
		super();

		if (message instanceof Error) {
			this.message = message.message;
			this.stack = message.stack;

			for (var property in message) {
				this[property] = message[property];
			}
		} else {
			this.message = message;
		}

		this.name = 'ForceThrowError';
	}
}

/**
 * Lilypads. Function memoization done right
 * @param {object} options - the options object
 * @param {function} responder - the responder function
 * @param {function} errorHandler - the error handler function
 *
 * @returns {promise}
**/
function lilypads(options, responder, errorHandler) {
	return new Promise(async (resolve, reject) => {
		try {
			const {id, lifetime} = options;
			const cache = lilypadsCache.open(id);
			const forceUpdate = Boolean(options.forceUpdate);
			const synchronous = options.forceUpdate === 'sync';

			const lilypad = {
				timestamp: null,
				response: null,
				isResolved: false,
				isCached: false
			};

			if (!synchronous && cache.fresh()) {
				const cacheContents = cache.get();

				lilypad.timestamp = cacheContents.timestamp;
				lilypad.response = cacheContents.response;
				lilypad.isCached = true;

				if (!lilypad.isResolved) {
					lilypad.isResolved = true;
					resolve(lilypad.response);
				}

				if (!forceUpdate) {
					if (isNumber(lifetime)) {
						// Is cache still fresh?
						if ((Date.now() - cacheContents.timestamp) < lifetime) {
							return;
						}
					} else {
						// assume infinity lifetime
						return;
					}
				}
			}

			const party = parties(id);

			if (party.exists()) {
				if (forceUpdate) {
					await party.crash();
				} else {
					resolve(party.crash());
					return;
				}
			}

			const host = party.host(
				new Promise(async (resolveParty, rejectParty) => {
					try {
						const response = await responder();
						const creationTimestamp = Date.now();

						cache.set({timestamp: creationTimestamp, response}, {
							lifetime: CACHE_LIFETIME
						});

						lilypad.timestamp = creationTimestamp;
						lilypad.response = response;
						lilypad.isResolved = true;
					} catch (error) {
						if (errorHandler) {
							errorHandler(error);
						}

						if (error instanceof ForceThrowError) {
							rejectParty(error);
							return;
						}

						if (synchronous && cache.fresh()) {
							delete options.forceUpdate;
							resolveParty(lilypads(options, responder, errorHandler));
							return;
						}

						if (!lilypad.isResolved) {
							rejectParty(error);
							return;
						}
					}

					resolveParty(lilypad.response);
				})
			);

			if (!lilypad.isResolved) {
				return resolve(host);
			}
		} catch (error) {
			reject(error);
		}
	});
}

lilypads.ForceThrowError = ForceThrowError;
module.exports = lilypads;
