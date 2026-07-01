const { execSync } = require('child_process');

// Detect production / Cloud Run environments
const isProduction = process.env.NODE_ENV === 'production' || !!process.env.K_SERVICE;

if (isProduction) {
  console.log('[Run Wrapper] Production/Cloud Run detected. Starting Express backend...');
  require('./backend/src/index.js');
} else {
  console.log('[Run Wrapper] Development detected. Starting concurrently...');
  execSync('npx concurrently "npm run dev:frontend" "npm run dev:backend"', { stdio: 'inherit' });
}
