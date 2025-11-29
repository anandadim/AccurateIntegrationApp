require('dotenv').config();
const fastify = require('fastify')({ logger: true });
const cors = require('@fastify/cors');
const db = require('./config/database');

// Register CORS
fastify.register(cors, {
  origin: true
});

// Register routes
fastify.register(require('./routes/api'), { prefix: '/api' });

// Health check
fastify.get('/', async (request, reply) => {
  return { status: 'ok', message: 'Accurate API Integration Server' };
});

// Start server
const start = async () => {
  try {
    // Initialize database
    await db.initialize();
    
    const port = process.env.PORT || 3000;
    await fastify.listen({ port, host: '0.0.0.0' });
    console.log(`Server running on http://localhost:${port}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
