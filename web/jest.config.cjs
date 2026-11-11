// Jest (no Vitest) con babel-jest y jsdom, aunque el proyecto use Vite.
module.exports = {
  testEnvironment: 'jsdom',
  transform: { '^.+\\.[jt]sx?$': 'babel-jest' },
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  testMatch: ['<rootDir>/src/**/*.test.{js,jsx}'],
  moduleNameMapper: {
    // import.meta.env solo existe en Vite: en Jest se reemplaza entorno.js por un mock.
    '^(\\.{1,2}/)+entorno(\\.js)?$': '<rootDir>/src/__mocks__/entorno.js',
    '\\.(css|svg|png|jpg)$': '<rootDir>/src/__mocks__/archivoEstatico.js',
  },
  collectCoverageFrom: ['src/**/*.{js,jsx}', '!src/main.jsx', '!src/__mocks__/**'],
  coverageDirectory: 'coverage',
  // npm run test:coverage falla si la cobertura baja de 80 %.
  coverageThreshold: { global: { statements: 80, branches: 80, functions: 80, lines: 80 } },
}
