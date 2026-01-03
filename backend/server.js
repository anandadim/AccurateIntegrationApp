require('dotenv').config();
const fastify = require('fastify')({ logger: true });
const cors = require('@fastify/cors');
const db = require('./config/database');
const { initScheduler } = require('./services/scheduler');

const allowedOrigins = [
        'http://170.171.172.216:8080',
        'http://170.171.172.197:8080'
];

fastify.register(cors, {
        origin: (origin, cb) => {
         if(!origin || allowedOrigins.includes(origin)) {
          cb(null, true);
        } else {
         cb(new Error('Not allowed'), false);
        }
        }
}
);

// Register CORS
// fastify.register(cors, {
//  origin: true
// });

// Add content type parser for JSON
fastify.addContentTypeParser('application/json', { parseAs: 'string' }, function (req, body, done) {
  try {
    const json = JSON.parse(body);
   done(null, json);
  } catch (err) {
    err.statusCode = 400;
    done(err, undefined);
  }
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
    
    // Initialize scheduler
    initScheduler();
    
    const port = process.env.PORT;
    await fastify.listen({ port, host: '0.0.0.0' });
    console.log(`Server running on http://localhost:${port}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
