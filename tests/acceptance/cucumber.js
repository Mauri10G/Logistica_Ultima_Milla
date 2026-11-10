module.exports = {
  default: {
    paths: ['features/**/*.feature'],
    require: ['features/steps/**/*.js'],
    format: ['progress-bar', 'html:reports/cucumber.html'],
  },
}
