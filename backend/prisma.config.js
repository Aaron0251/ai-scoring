const { defineConfig } = require('prisma/config')
const { PrismaPg } = require('@prisma/adapter-pg')
require('dotenv').config()

module.exports = defineConfig({
  schema: 'prisma/schema.prisma',
  datasource: {
    url: process.env.DIRECT_URL,
  },
  migrate: {
    adapter: () => new PrismaPg({ connectionString: process.env.DIRECT_URL }),
  },
})
