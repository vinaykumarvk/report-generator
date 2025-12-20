const { createServer } = require('./server');

async function start() {
  const services = require('./services');
  const app = createServer(services);
  const port = process.env.PORT || 3000;
  app.listen(port, () => console.log(`Server listening on ${port}`));
}

start();
