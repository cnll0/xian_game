module.exports = {
  testEnvironment: 'jsdom',
  roots: ['<rootDir>/js'],
  testMatch: ['**/__tests__/**/*.test.js'],
  moduleFileExtensions: ['js'],
  collectCoverageFrom: [
    'js/engine/**/*.js',
    '!js/engine/compat.js',
    '!js/engine/Engine.js'
  ],
  coverageThreshold: {
    global: {
      branches: 50,
      functions: 50,
      lines: 50,
      statements: 50
    }
  },
  setupFilesAfterEnv: ['<rootDir>/js/__tests__/setup.js']
};