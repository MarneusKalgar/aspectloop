import http from 'node:http';

const port = Number(process.env.PERSISTENCE_MOCK_PORT ?? 8090);

const server = http.createServer((req, res) => {
  res.setHeader('content-type', 'application/json');

  if (req.method === 'GET' && req.url === '/health') {
    res.end(JSON.stringify({ status: 'ok', service: 'persistence-mock' }));
    return;
  }

  res.statusCode = 501;
  res.end(JSON.stringify({ message: 'Persistence mock behavior starts in Phase 1' }));
});

server.listen(port, () => {
  console.log(`Persistence mock listening on ${port}`);
});