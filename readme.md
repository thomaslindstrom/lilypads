# lilypads

memoized functions done right

```
npm install lilypads
```

## Why, and what it does

I found myself writing a lot of _optimised handler functions_ that were repeating a lot of the optimization techniques over and over again. This module does all of that for you.

Provided a unique `id`, `lilypads` will, after the first call, ensure immediate function responses.

Upon an initial first call with the `id` `user-34134-data`, it will get the data from the provided `responder` function. However, next time the same request is made, `lilypads` will naively and immediately send the same result as it got from the `responder` function earlier.

In addition to this, `lilypads` has `@amphibian/party` built in, which ensures multiple calls to what would give the same response only trigger the `responder` function once.

## Usage

```javascript
import lilypads from 'lilypads';
import {slowGetUserData} from './interfaces/user';

export default function optimizedGetUserData(userId) {
    return lilypads({
        id: `optimizedGetUserData/${userId}`,
        lifetime: 5 * 60 * 1000 // 5 minutes
    }, () => getUserData(userId));
}
```

### Step by step

Assume a call to `id` `user-34134-data`:

#### First call

1. Calls the `responder` function.
2. Returns the response.

#### Second call

Immediately returns the previous result of the `responder` function.

#### Fourth call, assuming provided `lifetime` has expired

1. Immediately returns the previous result.
2. In the background, calls the `responder` function and swaps the current result with a new one.

#### A note on error handling

If the `lilypads` `responder` encounters an error the first time it runs, it will throw an error. However, if it has already been run successfully, `lilypads` will swallow the error and send it to the optional `errorHandler` you can provide.

Consider the following code:

```javascript
let shouldError = false;

function slowGetUserData(userId) {
    if (shouldError) {
        throw new Error();
    }

    shouldError = true;
    return {user: 'test'};
}

function optimizedGetUserData(userId) {
    return lilypads(context, {
		id: `optimizedGetUserData/${userId}`
	}, () => getUserData(userId));
}

(async () => {
    await optimizedGetUserData('1');
    await optimizedGetUserData('1');
})();
```

No errors will be thrown because the `responder` function has already had a successful run. The error can be handled by implementing an `errorHandler`:

```javascript
// ...

await lilypads(context, {
	id: `optimizedGetUserData/${userId}`
}, () => (
	getUserData(userId)
), (error) => {
    console.error('This error happened:', error);
});

// ...
```

However, if the error is thrown _before the `responder` has been run once, successfully_, the error is thrown “as normal”:

```javascript
// ...

try {
    await lilypads(context, {
		id: `optimizedGetUserData/${userId}`
	}, () => (
		getUserData(userId)
	), (error) => {
		console.error('This error happened:', error);
	});
} catch (error) {
    console.error('This error happened:', error);
}

// ...
```

To ensure an error is *always* thrown, use `lilypads.ForceThrowError`:

```javascript
let shouldError = false;

function slowGetUserData(userId) {
    if (shouldError) {
        throw new lilypads.ForceThrowError();
    }

    shouldError = true;
    return {user: 'test'};
}

function optimizedGetUserData(userId) {
    return lilypads(context, {
		id: `optimizedGetUserData/${userId}`
	}, () => getUserData(userId));
}

(async () => {
    await optimizedGetUserData('1');
    await optimizedGetUserData('1');
})();
```

This time, an error _will_ be thrown, even if the previous `responder` function had a successful run. Both of these approaches will work:

```javascript
throw new lilypads.ForceThrowError();
throw new lilypads.ForceThrowError(new Error('my error'));
```

#### A note on cache invalidation

Sometimes you make changes in your, ie., database that you would like to reflect immediately. There's an option to force update a `lilypad` in the `options` object: `forceUpdate`.

It should be set to either `sync` or `async` depending on the desired effect. If you make a change that does not need immediate reflection, use `async`. If not, use `sync`.

```javascript
// ...

function getUser(userId, options) {
    return lilypads({
        ...options,
        id: `getUser/${userId}`
    }, () => getUserDataFromDatabase(userId));
}

function updateUser(userId) {
    await updateUserInDatabase(userId, {email: 'test@bazinga.com'});
    return getUser(userId, {forceUpdate: 'sync'});
}

// ...
```

`forceUpdate` should only be set on the `lilypad` call _when you know there's been a change_. You could also implement some invalidation logic to be evaluated on runtime:

```javascript
// ...
import invalidate, {stale} from '../my-utilities/invalidations';

function getUser(userId, options) {
	if (stale(`my-invalidation-logic/${userId}`)) {
		options.forceUpdate = 'sync';
	}

    return lilypads({
        ...options,
        id: `getUser/${userId}`
    }, () => getUserDataFromDatabase(userId));
}

async function updateUser(userId) {
	await updateUserInDatabase(userId, {email: 'test@bazinga.com'});
	invalidate(`my-invalidation-logic/${userId}`);
    return getUser(userId);
}

// ...
```

### `lilypads`

#### Usage

```javascript
lilypads(options, responder);
```

##### `options` _(`Object`)_ **Required.**

###### `options.id` _(`String`)_ **Required.**

Should be _unique_, yet the same for requests that expect the same response. Function arguments used within `responder` should probably be represented here in some way. For example:

- `user/34134`
- `my-blog/article/213`

###### `options.lifetime` _(`Number`)_

How long each `responder` result will live in milliseconds. If `undefined`, the result lives forever (or until `forceUpdate` is set). If set to, eg., `3000`, `leap` will get a new version after `3000`ms. But it won't throw out the old one until the new one is ready.

##### `options.forceUpdate` _(`String`)_: `sync`|`async`

To force update the `lilypad`, set `forceUpdate` to either `sync` or `async`. This will ensure the `responder` function is called to update the cached return value.

You have two choices:

###### `sync`

The `lilypad` will call the `responder` function and resolve upon its completion. This is useful when the change made needs to be reflected immediately.

###### `async`

The `lilypad` will resolve immediately, as normal, returning an “old” `responder` result (if any) – but will, in the background, call the `responder` function to update the `lilypad`.

##### `responder` _(`Function`)_

The function that returns the request response. It is given no arguments when called. Can return a `Promise`.

##### `errorHandler` _(`Function`)_

The function that is given any error encountered running the `responder` function.

#### Returns `lilypad`

The response.
