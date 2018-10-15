'use strict'

module.exports = {
  enabled: !process.env.ARK_WEBHOOKS_DISABLED,
  database: {
    dialect: 'sqlite',
    storage: `${process.env.ARK_PATH_DATA}/database/${process.env.ARK_NETWORK_NAME}/webhooks.sqlite`,
    logging: process.env.ARK_DB_LOGGING
  },
  server: {
    enabled: !process.env.ARK_WEBHOOKS_API_DISABLED,
    host: process.env.ARK_WEBHOOKS_HOST || '0.0.0.0',
    port: process.env.ARK_WEBHOOKS_PORT || 4004,
    pagination: {
      limit: 100,
      include: [
        '/api/webhooks'
      ]
    },
    whitelist: ['127.0.0.1', '::ffff:127.0.0.1', '192.168.*']
  }
}
