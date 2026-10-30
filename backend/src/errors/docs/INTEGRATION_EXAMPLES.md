# Integration examples

Register the shared middleware once:

```js
import { errorHandler, localeMiddleware, notFound } from './errors/index.js';

app.use(localeMiddleware);
app.use('/api', routes);
app.use(notFound);
app.use(errorHandler);
```

Validate a route with a Zod schema:

```js
router.post('/declarations', validateRequest(declarationSchema), controller.create);
```

Keep services transport-independent:

```js
throw new AppError({
  message: 'Declaration not found',
  statusCode: 404,
  code: ERROR_CODES.RESOURCE_NOT_FOUND,
});
```
