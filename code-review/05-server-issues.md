# Server-Side Issues

## 1. `req.user!.id` non-null assertions everywhere

Every route handler uses `req.user!.id` because the TypeScript declaration (`declare module 'express'`) adds `user?` as optional, but the `authMiddleware` guarantees it's set. Use `express.Request` type assertion helpers or assertion middleware to avoid the `!`.

Better approach: create a type like `AuthenticatedRequest = Request & { user: AuthUser }` and use it in route handlers behind auth middleware.

## 2. Path parameter type fragility in `files.ts`

The catch-all `:path(*)` param type is `string | string[] | undefined`. The code manually handles arrays:
```ts
const pathStr = Array.isArray(pathParam) ? pathParam.join('/') : (pathParam || '');
```

This is fine but fragile. Express 5's type changes could break this without warning.

## 3. SQL injection surface — path LIKE clause

`files.ts` line 215:
```ts
db.prepare('DELETE FROM files WHERE path LIKE ?').run(normalizedPath + '%');
```

While parameterized, embedding user-controlled `path` into a LIKE pattern is safe here because `better-sqlite3` parameterizes the value, but if `path` contains `%` or `_` literals in the data, unexpected rows could be deleted. Use `sanitizeLike` or escape the wildcards.

## 4. No request body validation

Project creation only checks `typeof name !== 'string'`. No schema validation library (zod, joi, yup). Malformed requests produce confusing 500 errors rather than helpful 400s.

## 5. Migration directory reads `readdirSync` unsorted — actually sorted

Line 55: `const files = readdirSync(migrationsDir).filter(f => f.endsWith('.sql')).sort()` — the `.sort()` is present but would fail if version numbers exceed 9 (10 < 9 lexicographically). This is actually fine given the current file naming, but worth noting.

## 6. Files router mounted twice

`projects.ts` line 170: `router.use('/:id/files', createFilesRouter())` — the files router is instantiated here.
`projects.ts` line 172: `router.use('/:id/share', createSharesRouter())` — shares router.

But `files.ts` also exports a `createProjectRouter()` (line 229) that mounts files under `/projects/:id` — this appears to be dead code / unused.

## 7. Server logs tokens in request logging

The `app.use` logging middleware (server/index.ts line 19) logs `req.url` which includes query params. It doesn't log the Authorization header, but if anyone adds query-param-based auth later, tokens could leak into logs.
