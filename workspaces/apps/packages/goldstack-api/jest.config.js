// eslint-disable-next-line @typescript-eslint/no-var-requires
const base = require('./../../jest.config');

module.exports = {
  ...base,
  testPathIgnorePatterns: ['<rootDir>/goldstackLocal/'],
};
