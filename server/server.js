import { fileURLToPath } from 'url';
import Integrations from '@sentry/integrations';
import Sentry from '@sentry/node';
import express from 'express';
import { isHttpError } from 'http-errors';
import middleware from './middleware.js';

import apiV3 from './lib/v3/api.js';
import apiV4 from './lib/v4/api.js';

process.env.USERNAME_SALT ||= 'coinspace-local-salt';

const app = express();

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.SENTRY_ENVIRONMENT,
  release: `coin.server@${process.env.npm_package_version || '6.33.0'}`,
  integrations: [
    new Integrations.CaptureConsole({
      levels: ['error'],
    }),
  ],
});
app.use(Sentry.Handlers.requestHandler());

middleware.init(app);

// API routes
app.use('/api/v3', apiV3);
app.use('/api/v4', apiV4);
app.set('views', fileURLToPath(new URL('./views', import.meta.url)));
app.set('view engine', 'ejs');

const siteUrl = process.env.SITE_URL || process.env.APP_URL || 'http://localhost:3000';
const siteUrlTor = process.env.SITE_URL_TOR || siteUrl;

if (process.env.IS_TOR !== 'true') {
  app.get('/.well-known/webauthn', (req, res) => {
    const origins = new Set([
      new URL(siteUrl).origin,
      new URL(siteUrlTor).origin,
    ]);
    const forwardedHost = req.get('X-Forwarded-Host')?.split(',')[0]?.trim();
    if (forwardedHost) {
      origins.add(`https://${forwardedHost}`);
    }
    return res.json({
      origins: [...origins],
    });
  });
}

const distDir = fileURLToPath(new URL('./dist', import.meta.url));
app.get('*', (req, res, next) => {
  if (isAssetsPath(req.path)) return next();
  res.sendFile('index.html', { root: distDir });
});

function isAssetsPath(path) {
  return path.match(/\/assets\//);
}

app.use(Sentry.Handlers.errorHandler());

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.log(err.stack || err.message || err);
  const status = err.status || 500;

  res.status(status);

  if (isHttpError(err)) {
    res.send({
      error: err.expose === true ? err.message : err.name,
      code: status,
    });
  } else {
    res.send({
      error: 'Oops! something went wrong.',
      code: status,
    });
  }
});

// eslint-disable-next-line no-unused-vars
app.use((req, res, next) => {
  res.status(404).send({ error: 'Oops! page not found.' });
});

const port = Number(process.env.PORT) || 3000;
const server = app.listen(port, '0.0.0.0', () => {
  console.info('server listening on http://0.0.0.0:' + server.address().port);
  server.timeout = 30000; // 30 sec
});
