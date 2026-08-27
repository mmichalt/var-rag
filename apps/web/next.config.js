const { join } = require('path');

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  outputFileTracingRoot: join(__dirname, '../..'),
};

module.exports = nextConfig;
