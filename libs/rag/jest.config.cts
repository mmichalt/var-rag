const { readFileSync } = require('fs');

const swcJestConfig = JSON.parse(
  readFileSync(`${__dirname}/.spec.swcrc`, 'utf-8'),
);
swcJestConfig.swcrc = false;

module.exports = {
  displayName: 'rag',
  preset: '../../jest.preset.js',
  testEnvironment: 'node',
  transform: {
    '^.+\\.[tj]s$': ['@swc/jest', swcJestConfig],
  },
  transformIgnorePatterns: ['/node_modules/(?!.*@prisma)'],
  moduleFileExtensions: ['ts', 'js', 'html'],
  coverageDirectory: 'test-output/jest/coverage',
};
