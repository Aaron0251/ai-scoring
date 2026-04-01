require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
p.user.findMany({ select: { id: true, username: true, name: true, roles: true, active: true } })
  .then(users => {
    console.log('User count:', users.length);
    users.forEach(u => console.log(' -', u.username, '|', u.name, '| roles:', u.roles, '| active:', u.active));
  })
  .catch(e => console.error('DB Error:', e.message))
  .finally(() => p.$disconnect());
