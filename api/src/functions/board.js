'use strict';
// Azure Functions entry point: registers GET /api/board. The logic is in ../handler.js.
const { app } = require('@azure/functions');
const { makeHandler } = require('../handler');
// One board reader for the app and the daily sync: tools/azure/build-api.sh copies scripts/lib into the
// deploy package as api/lib; when running from the repo, it's read from scripts/lib directly.
function boardReader() {
  try { return require('../../lib/pinterest-public'); } catch (e) {
    if (e.code !== 'MODULE_NOT_FOUND') throw e;
    return require('../../../scripts/lib/pinterest-public');
  }
}
const { fetchPublicBoard, parseBoardUrl } = boardReader();

const handle = makeHandler({
  fetchPublicBoard,
  parseBoardUrl,
  allowedOrigins: (process.env.ALLOWED_ORIGINS || '').split(',')
});

app.http('board', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'board',
  handler: (request, context) => handle(request, msg => context.warn(msg))
});
