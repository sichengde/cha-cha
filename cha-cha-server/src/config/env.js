require('dotenv').config()

function readEnvString(name, defaultValue) {
  const raw = process.env[name]
  if (raw === undefined || raw === null) {
    return defaultValue
  }

  const value = String(raw).trim()
  if (value === '' && defaultValue !== undefined) {
    return defaultValue
  }

  return value
}

function readEnvInt(name, defaultValue) {
  const raw = readEnvString(name, '')
  const parsed = parseInt(raw, 10)
  if (isNaN(parsed)) {
    return defaultValue
  }
  return parsed
}

function readEnvBoolean(name, defaultValue) {
  const raw = readEnvString(name, '')
  if (raw === '') {
    return defaultValue
  }
  return raw === 'true' || raw === '1'
}

module.exports = {
  readEnvString,
  readEnvInt,
  readEnvBoolean
}
