module.exports = {
  default: {
    paths: ['features/**/*.feature'],
    require: ['features/steps/**/*.js'],
    // @pendiente: escenarios que esperan endpoints del backend (ajustes de rutas, login); se corren con npm run test:pendientes
    tags: 'not @pendiente',
    format: ['progress-bar', 'html:reports/cucumber.html'],
  },
  pendientes: {
    paths: ['features/**/*.feature'],
    require: ['features/steps/**/*.js'],
    tags: '@pendiente',
    format: ['progress-bar', 'html:reports/cucumber-pendientes.html'],
  },
}
