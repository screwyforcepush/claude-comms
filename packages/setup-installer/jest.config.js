/** @type {import('jest').Config} */
module.exports = {
  // Test environment
  testEnvironment: 'node',
  
  // Patterns
  testMatch: [
    '<rootDir>/test/**/*.test.js',
    '<rootDir>/test/**/*.test.ts'
  ],
  
  // Module paths
  roots: ['<rootDir>/src', '<rootDir>/test'],
  moduleDirectories: ['node_modules', '<rootDir>/src'],
  
  // File extensions
  moduleFileExtensions: ['js', 'ts', 'json'],
  
  // Transform
  transform: {
    '^.+\\.(ts|tsx)$': 'ts-jest',
    '^.+\\.(js|jsx)$': 'babel-jest'
  },
  
  // Coverage configuration
  collectCoverage: true,
  coverageDirectory: '<rootDir>/coverage',
  coverageReporters: ['text', 'lcov', 'html', 'json'],
  
  // Coverage thresholds (as per testing strategy)
  coverageThreshold: {
    global: {
      branches: 85,
      functions: 90,
      lines: 90,
      statements: 90
    },
    // Critical path coverage requirements
    './src/index.js': {
      branches: 100,
      functions: 100,
      lines: 100,
      statements: 100
    },
    './src/fetcher/github.js': {
      branches: 95,
      functions: 95,
      lines: 95,
      statements: 95
    },
    './src/installer/file-writer.js': {
      branches: 95,
      functions: 95,
      lines: 95,
      statements: 95
    }
  },
  
  // What to collect coverage from
  collectCoverageFrom: [
    'src/**/*.{js,ts}',
    '!src/**/*.d.ts',
    '!src/**/index.js',
    '!src/**/*.test.{js,ts}',
    '!**/node_modules/**',
    '!**/test/**'
  ],
  
  // Setup files
  setupFilesAfterEnv: ['<rootDir>/test/setup.js'],
  
  // Mock configuration
  clearMocks: true,
  resetMocks: true,
  restoreMocks: true,
  
  // Module mapping for absolute imports
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@test/(.*)$': '<rootDir>/test/$1'
  },
  
  // Test timeout (30 seconds for network tests)
  testTimeout: 30000,
  
  // Verbose output for development
  verbose: true,
  
  // Error handling
  bail: false,
  errorOnDeprecated: true,
  
  // Performance
  maxWorkers: '50%',
  
  // Test results
  reporters: [
    'default',
    ['jest-junit', {
      outputDirectory: 'test-results',
      outputName: 'junit.xml'
    }]
  ],
  
  // Global configuration
  globals: {
    'ts-jest': {
      useESM: false
    }
  },
  
  // Test categories
  runner: 'jest-runner',
  
  // Mock patterns for external dependencies
  transformIgnorePatterns: [
    'node_modules/(?!(nock|supertest)/)'
  ]
};