const { execSync } = require('child_process');

if (process.env.NODE_ENV === 'production') {
  console.log('[Run Wrapper] Production detected. Starting Express backend...');
  require('./backend/src/index.js');
} else {
  console.log('[Run Wrapper] Development detected. Starting concurrently...');
  execSync('npx concurrently "npm run dev:frontend" "npm run dev:backend"', { stdio: 'inherit' });
}
