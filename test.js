const lilypads = require('.');

lilypads.logging = true;

/**
 * Expect a function to throw
 * @param {function} test - the test function
 * @param {function} callback - the callback
**/
async function expectToThrow(test, callback) {
	try {
		await test();
	} catch (error) {
		callback(error);
		return;
	}

	throw new Error('No error thrown.');
}

/**
 * Generate a random string
 * @returns {string}
**/
function randomString() {
	return Math.random().toString(36).substring(2);
}

/**
 * Delay X milliseconds
 * @param {number} milliseconds - the number of milliseconds to wait
 * @returns {promise}
**/
function delay(milliseconds) {
	return new Promise((resolve) => {
		setTimeout(resolve, milliseconds);
	});
}

test('callback with error on test failure', () => {
	const errorMessage = 'Some error';

	return expectToThrow(() => {
		throw new Error(errorMessage);
	}, (error) => {
		expect(error.message).toBe(errorMessage);
	});
});

test('failing: throw when no errors are thrown', async () => {
	try {
		await expectToThrow(() => {});
	} catch (error) {
		expect(error.message).toBe('No error thrown.');
		return;
	}

	throw new Error('No error thrown.');
});

test('get a random string', () => {
	expect(typeof randomString()).toBe('string');
});

test('wait X milliseconds', () => (
	delay(250)
));

test('should return lilypad (if any) when responder is not provided', async () => {
	const id = randomString();
	const content = 'hello';

	await lilypads({id}, () => content);

	const lilypad = await lilypads({id});
	expect(lilypad).toBe(content);
});

test('should throw faulty responder', () => (
	expectToThrow(() => (
		lilypads({id: randomString()}, () => {
			throw new Error('test');
		})
	), (error) => {
		expect(error.message).toBe('test');
	})
));

test('should update responder values', async () => {
	const id = randomString();
	const lifetime = 0;
	const content = 'test';

	await lilypads({id, lifetime}, () => 'something');
	await lilypads({id, lifetime}, () => content);

	const lilypad = await lilypads({id, lifetime});

	expect(lilypad).toBe(content);
});

test('should not throw faulty responder if resolved by previous responder', async () => {
	const id = randomString();
	const content = 'test';

	await lilypads({id}, () => content);

	const lilypad = await lilypads({id}, () => {
		throw new Error('test');
	});

	expect(lilypad).toBe(content);
});

test('should not throw faulty responder after exceeded lifetime if resolved by previous responder', async () => {
	const id = randomString();
	const content = 'test';
	const options = {id, lifetime: 500};

	await lilypads(options, () => content);
	await delay(options.lifetime + 100);

	const lilypad = await lilypads(options, () => {
		throw new Error('test');
	});

	expect(lilypad).toBe(content);
});

test('should gracefully use the most recent successful responder result', async () => {
	const id = randomString();
	const content = 'hello';

	await lilypads({id}, () => content);

	const lilypad = await lilypads({id}, () => {
		throw new Error('test');
	});

	expect(lilypad).toBe(content);
});

test('should gracefully use the most recent successful responder result when it changed post-error', async () => {
	const id = randomString();
	const lifetime = 0;
	const content = 'hello';

	await lilypads({id, lifetime}, () => 'not the variable');
	await lilypads({id, lifetime}, () => {
		throw new Error('test');
	});

	await delay(0);
	await lilypads({id, lifetime}, () => content);
	const lilypad = await lilypads({id, lifetime}, () => content);

	expect(lilypad).toBe(content);
});

test('should not call responder multiple times', async () => {
	const id = randomString();
	let counter = 0;

	await lilypads({id}, () => {
		counter += 1;
		return 'test';
	});

	await lilypads({id}, () => {
		counter += 1;
		return 'test';
	});

	await lilypads({id}, () => {
		counter += 1;
		return 'test';
	});

	expect(counter).toBe(1);
});

test('should throw when errorHandler is provided and there is no previous responder, but also call errorHandler, first', async () => {
	const id = randomString();
	const lifetime = 0;
	let callResult = '';

	try {
		await lilypads({id, lifetime}, () => {
			throw new Error('test');
		}, (error) => {
			callResult += 'a';
			expect(error.message).toBe('test');
		});
	} catch (error) {
		callResult += 'b';
		expect(error.message).toBe('test');
	}

	expect(callResult).toBe('ab');
});

test('should report errors to errorHandler function', async () => {
	const id = randomString();
	const lifetime = 0;

	let isCalled = false;

	await lilypads({id, lifetime}, () => 'content');
	await lilypads({id, lifetime}, () => {
		throw new Error('test');
	}, (error) => {
		isCalled = true;
		expect(error.message).toBe('test');
	});

	expect(isCalled).toBe(true);
});

test('should get lilypad result', async () => {
	const body = 'test';
	const lilypad = await lilypads({id: randomString()}, () => body);
	expect(lilypad).toBe(body);
});

test('should get second lilypad body from cache', async () => {
	const id = randomString();
	let expectedBody;

	const responder = () => {
		expectedBody = randomString();
		return expectedBody;
	};

	const firstLilypad = await lilypads({id}, responder);
	const secondLilypad = await lilypads({id}, responder);

	expect(firstLilypad).toBe(expectedBody);
	expect(secondLilypad).toBe(expectedBody);
});

test('should get lilypad string', async () => {
	const body = 'test';
	const lilypad = await lilypads({id: randomString()}, () => body);
	expect(lilypad).toBe(body);
});

test('should get lilypad object', async () => {
	const lilypad = await lilypads({id: randomString()}, () => ({
		test: true
	}));

	expect(lilypad.test).toBe(true);
});

test('should setup lilypad with lifetime', () => (
	lilypads({id: randomString(), lifetime: 1000}, () => 'test')
));

test('should avoid requesting new response when cache is fresh', async () => {
	const id = randomString();
	let expectedBody;

	const responder = () => {
		expectedBody = randomString();
		return expectedBody;
	};

	const firstLilypad = await lilypads({id, lifetime: 1000}, responder);
	const secondLilypad = await lilypads({id, lifetime: 1000}, responder);

	expect(firstLilypad).toBe(expectedBody);
	expect(secondLilypad).toBe(expectedBody);
});

test('should call responder once when alive', async () => {
	const id = randomString();
	let counter = 0;

	await lilypads({id, lifetime: 1000}, () => {
		counter += 1;
		return 'test';
	});

	await lilypads({id, lifetime: 1000}, () => {
		counter += 1;
		return 'test';
	});

	await lilypads({id, lifetime: 1000}, () => {
		counter += 1;
		return 'test';
	});

	expect(counter).toBe(1);
});

test('should not call responder multiple times when stale and concurrent', async () => {
	const id = randomString();
	let counter = 0;

	await Promise.all([
		lilypads({id, lifetime: -1}, () => {
			counter += 1;
			return 'test';
		}),
		lilypads({id, lifetime: -1}, () => {
			counter += 1;
			return 'test';
		}),
		lilypads({id, lifetime: -1}, () => {
			counter += 1;
			return 'test';
		})
	]);

	expect(counter).toBe(1);
});

test('should call responder multiple times when stale and not concurrent', async () => {
	const id = randomString();
	let counter = 0;

	await lilypads({id, lifetime: -1}, () => {
		counter += 1;
		return 'test';
	});

	await delay(500);

	await lilypads({id, lifetime: -1}, () => {
		counter += 1;
		return 'test';
	});

	await delay(500);

	await lilypads({id, lifetime: -1}, () => {
		counter += 1;
		return 'test';
	});

	expect(counter).toBe(3);
});

test('should force update the responder when forceUpdate is async', async () => {
	const id = randomString();
	const lifetime = 500;
	const body = 'hello';
	const finalForm = 'there';

	const firstLilypad = await lilypads({id, lifetime}, () => body);
	expect(firstLilypad).toBe(body);

	const secondLilypad = await lilypads({id, lifetime}, () => `${body}2`);
	expect(secondLilypad).toBe(body);

	const thirdLilypad = await lilypads({id, lifetime, forceUpdate: 'async'}, async () => {
		await delay(250);
		return finalForm;
	});

	expect(thirdLilypad).toBe(body);
	await delay(500);

	const fourthLilypad = await lilypads({id, lifetime}, () => 'nothing');
	expect(fourthLilypad).toBe(finalForm);
});

test('should asynchronously force update the responder when forceUpdate is async', async () => {
	const id = randomString();
	const lifetime = 2000;
	const body = 'hello';
	const finalForm = 'there';

	const firstLilypad = await lilypads({id, lifetime}, () => body);
	expect(firstLilypad).toBe(body);

	const secondLilypad = await lilypads({id, lifetime}, () => `${body}2`);
	expect(secondLilypad).toBe(body);

	const thirdLilypad = await lilypads({id, lifetime, forceUpdate: 'async'}, async () => {
		await delay(250);
		return finalForm;
	});

	expect(thirdLilypad).toBe(body);
	await delay(500);

	const fourthLilypad = await lilypads({id, lifetime});
	expect(fourthLilypad).toBe(finalForm);
});

test('should handle errors during asynchronous updates', async () => {
	const id = randomString();
	const lifetime = 2000;
	const body = 'hello';

	const firstLilypad = await lilypads({id, lifetime}, () => body);
	expect(firstLilypad).toBe(body);

	const secondLilypad = await lilypads({id, lifetime, forceUpdate: 'async'}, () => {
		throw new Error('test');
	});

	expect(secondLilypad).toBe(body);

	const thirdLilypad = await lilypads({id, lifetime}, () => `${body}2`);
	expect(thirdLilypad).toBe(body);
});

test('should force update when trying to async forceUpdate more than once simultaneously', async () => {
	const id = randomString();
	const lifetime = 2000;
	const body = 'hello';

	const firstLilypad = await lilypads({id, lifetime}, () => body);
	expect(firstLilypad).toBe(body);

	await Promise.all([
		lilypads({id, lifetime, forceUpdate: 'async'}, async () => {
			await delay(250);
			return `${body}2`;
		}),
		lilypads({id, lifetime, forceUpdate: 'async'}, async () => {
			await delay(500);
			return `${body}3`;
		})
	]);

	const secondLilypad = await lilypads({id, lifetime});
	expect(secondLilypad).toBe(body);

	await delay(300);

	const thirdLilypad = await lilypads({id, lifetime});
	expect(thirdLilypad).toBe(`${body}2`);

	await delay(550);

	const fourthLilypad = await lilypads({id, lifetime});
	expect(fourthLilypad).toBe(`${body}3`);
});

test('should force update the responder when forceUpdate is sync', async () => {
	const id = randomString();
	const lifetime = 500;
	const body = 'hello';
	const finalForm = 'there';

	const firstLilypad = await lilypads({id, lifetime}, () => body);
	expect(firstLilypad).toBe(body);

	const secondLilypad = await lilypads({id, lifetime}, () => `${body}2`);
	expect(secondLilypad).toBe(body);

	const thirdLilypad = await lilypads({id, lifetime, forceUpdate: 'sync'}, async () => {
		await delay(250);
		return finalForm;
	});

	expect(thirdLilypad).toBe(finalForm);
});

test('should fallback to previous responder result if force updating the responder fails during sync', async () => {
	const id = randomString();
	const lifetime = 500;
	const body = 'hello';
	let tried = false;

	const firstLilypad = await lilypads({id, lifetime}, () => body);
	expect(firstLilypad).toBe(body);

	const secondLilypad = await lilypads({id, lifetime, forceUpdate: 'sync'}, async () => {
		await delay(250);
		tried = true;
		throw new Error('test');
	});

	expect(secondLilypad).toBe(body);
	expect(tried).toBe(true);
});

test('should throw when forceUpdate is synchronous and no previous responder was resolved', () => (
	expectToThrow(() => (
		lilypads({id: randomString(), forceUpdate: 'sync'}, () => {
			throw new Error('test');
		})
	), (error) => {
		expect(error.message).toBe('test');
	})
));

test('should throw if ForceThrowError is thrown when updating the responder fails during sync', async () => {
	const id = randomString();
	const lifetime = 500;
	const body = 'hello';
	let tried = false;

	const firstLilypad = await lilypads({id, lifetime}, () => body);
	expect(firstLilypad).toBe(body);

	return expectToThrow(() => (
		lilypads({id, lifetime, forceUpdate: 'sync'}, async () => {
			await delay(250);
			tried = true;
			throw new lilypads.ForceThrowError('test');
		})
	), (error) => {
		expect(tried).toBe(true);
		expect(error.message).toBe('test');
		expect(error.name).toBe('ForceThrowError');
		expect(error instanceof lilypads.ForceThrowError).toBe(true);
	});
});

test('should throw when forceUpdate is synchronous and a ForceThrowError is thrown', () => (
	expectToThrow(() => (
		lilypads({
			id: randomString(),
			forceUpdate: 'sync'
		}, () => {
			throw new lilypads.ForceThrowError('test');
		})
	), (error) => {
		expect(error.message).toBe('test');
		expect(error.name).toBe('ForceThrowError');
		expect(error instanceof lilypads.ForceThrowError).toBe(true);
	})
));

test('should throw when forceUpdate is synchronous and a ForceThrowError is thrown with an error as input', () => (
	expectToThrow(() => (
		lilypads({
			id: randomString(),
			forceUpdate: 'sync'
		}, () => {
			const inputError = new Error('test');
			inputError.key = 'testkey';
			inputError.code = 'testcode';
			throw new lilypads.ForceThrowError(inputError);
		})
	), (error) => {
		expect(error.message).toBe('test');
		expect(error.code).toBe('testcode');
		expect(error.key).toBe('testkey');
		expect(error.name).toBe('ForceThrowError');
		expect(error instanceof lilypads.ForceThrowError).toBe(true);
	})
));

