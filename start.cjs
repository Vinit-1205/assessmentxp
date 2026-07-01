const { execSync } = require('child_process');

if (process.env.RUN_BACKEND === 'true') {
  console.log('[Start Wrapper] Starting Express Backend...');
  require('./backend/src/index.js');
} else {
  console.log('[Start Wrapper] Starting Frontend Static Server...');
  const port = process.env.PORT || '8080';
  // Use npx serve (which resolves to local node_modules/.bin/serve first)
  execSync(`npx serve -s dist -l ${port}`, { stdio: 'inherit' });
}
