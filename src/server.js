const app = require('./app');

const PORT = process.env.PORT || 3000;

const server = app.listen(PORT, () => {
  console.log(`
╔══════════════════════════════════════════════════════╗
║       Finance Data Processing & Access Control       ║
║                  Backend API Server                  ║
╠══════════════════════════════════════════════════════╣
║  Status  : Running                                   ║
║  Port    : ${String(PORT).padEnd(42)}║
║  Env     : ${String(process.env.NODE_ENV || 'development').padEnd(42)}║
║  Docs    : http://localhost:${String(PORT + '/api').padEnd(33)}║
╠══════════════════════════════════════════════════════╣
║  Seed Credentials                                    ║
║  admin@finance.dev     / Admin@123   (admin)         ║
║  alice@finance.dev     / Alice@123   (analyst)       ║
║  victor@finance.dev    / Victor@123  (viewer)        ║
╚══════════════════════════════════════════════════════╝
  `);
});

// Graceful shutdown
process.on('SIGTERM', () => { server.close(() => { console.log('Server closed.'); process.exit(0); }); });
process.on('SIGINT',  () => { server.close(() => { console.log('Server closed.'); process.exit(0); }); });

module.exports = server;
