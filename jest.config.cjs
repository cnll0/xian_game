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
  setupFilesAfterSetup: ['<rootDir>/js/__tests__/setup.js'],
  globals: {
    window: {},
    document: {},
    console: console,
    requestAnimationFrame: (cb) => setTimeout(cb, 16),
    cancelAnimationFrame: (id) => clearTimeout(id),
    localStorage: {
      getItem: jest.fn(),
      setItem: jest.fn(),
      removeItem: jest.fn(),
      clear: jest.fn(),
      key: jest.fn(),
      length: 0
    }
  }
};