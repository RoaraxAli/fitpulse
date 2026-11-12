const { connect } = require('../server/db');
const { createApp } = require('../server/app');

// Vercel keeps warm instances alive, so the Mongo connection is reused across
// invocations. We cache the bootstrap promise at module scope for that reason.
let appPromise = null;

function getApp() {
  if (!appPromise) {
    appPromise = connect(process.env.MONGODB_URI, process.env.MONGODB_DB || 'fitpulse')
      .then(() => createApp())
      .catch((error) => {
        appPromise = null;
        throw error;
      });
  }
  return appPromise;
}

module.exports = async (req, res) => {
  try {
    const app = await getApp();
    return app(req, res);
  } catch (error) {
    console.error('FitPulse bootstrap failed:', error && error.message ? error.message : error);
    if (!res.headersSent) {
      res.statusCode = 503;
      res.setHeader('content-type', 'application/json');
      console.error('FitPulse bootstrap failed:', error && error.message ? error.message : error);
      console.error('MONGODB_URI set:', Boolean(process.env.MONGODB_URI), 'MONGODB_DB:', process.env.MONGODB_DB);
      res.end(JSON.stringify({ ok: false, error: { code: 'database_unavailable', message: 'Database unavailable.', detail: String(error && error.message ? error.message : error) } }));
    }
  }
};
