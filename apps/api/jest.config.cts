const { readFileSync } = require('fs');

// Reading the SWC compilation config for the spec files
const swcJestConfig = JSON.parse(
  readFileSync(`${__dirname}/.spec.swcrc`, 'utf-8'),
);

// Disable .swcrc look-up by SWC core because we're passing in swcJestConfig ourselves
swcJestConfig.swcrc = false;

module.exports = {
  displayName: 'api',
  preset: '../../jest.preset.js',
  testEnvironment: 'node',
  transform: {
    '^.+\\.[tj]s$': ['@swc/jest', swcJestConfig],
    '^.+\\.mjs$': [
      '@swc/jest',
      {
        jsc: { parser: { syntax: 'ecmascript' } },
        module: { type: 'commonjs' },
      },
    ],
  },
  moduleFileExtensions: ['ts', 'js', 'mjs', 'html'],
  coverageDirectory: 'test-output/jest/coverage',
};
