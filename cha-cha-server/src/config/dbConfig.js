const { readEnvInt, readEnvString } = require('./env')

function getDbName() {
  return readEnvString('DB_NAME', 'cha_cha')
}

function getDbConfig(extraConfig) {
  const config = {
    host: readEnvString('DB_HOST', 'localhost'),
    port: readEnvInt('DB_PORT', 3306),
    user: readEnvString('DB_USER', 'root'),
    password: readEnvString('DB_PASSWORD', ''),
    database: getDbName()
  }

  if (extraConfig) {
    return Object.assign(config, extraConfig)
  }

  return config
}

function getDbServerConfig(extraConfig) {
  const baseConfig = getDbConfig()
  delete baseConfig.database

  if (extraConfig) {
    return Object.assign(baseConfig, extraConfig)
  }

  return baseConfig
}

module.exports = {
  getDbName,
  getDbConfig,
  getDbServerConfig
}
