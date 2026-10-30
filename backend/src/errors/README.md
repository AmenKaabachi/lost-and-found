# Centralized error management

This self-contained module is the shared error-management foundation for all
Lost & Found binômes. Import public components from `backend/src/errors/index.js`
instead of reaching into internal folders:

```js
import { AppError, ERROR_CODES, validateRequest } from '../errors/index.js';

throw new AppError({
  message: 'Declaration not found',
  statusCode: 404,
  code: ERROR_CODES.RESOURCE_NOT_FOUND,
});
```

It provides standardized errors and responses, Zod validation, request-local
English/French/Arabic translations, locale detection, Pino logging, 404/async
middleware, an isolated demo API, and its tests.

Services should throw `AppError` and never create HTTP responses or translate
messages. The global handler translates the error code for the current request
and never exposes stacks or internal messages.

To add an error, update `core/errorCodes.js`, add the same key under `errors`
in all three dictionaries, and add response tests. Validation translations
belong under `validation`.

Run only this module:

```bash
npm run test:errors
npm run test:errors:coverage
```

Coverage is generated locally by Vitest and ignored by Git.
