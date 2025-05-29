const { Pool } = require('pg');

const pool = new Pool({
  user: 'postgres.fsfmbaysjwzpaqugpdat',
  password: '10010512111111497', // parolingizni bu yerga yozing
  host: 'aws-0-eu-north-1.pooler.supabase.com',
  port: 6543,
  database: 'postgres',
  ssl: {
    rejectUnauthorized: false // Supabase uchun SSL kerak bo'ladi
  }
});

module.exports = pool;
