const http = require('node:http');

function checkBackend() {
  return new Promise((resolve) => {
    const req = http.get('http://127.0.0.1:3001/', { timeout: 2000 }, (res) => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => {
        try {
          const response = JSON.parse(body);
          resolve(res.statusCode === 200 && response?.data?.message === 'Yorumi Backend is running' ? 'ready' : 'occupied');
        } catch { resolve('occupied'); }
      });
    });
    req.on('timeout', () => req.destroy());
    req.on('error', (error) => resolve(error.code === 'ECONNREFUSED' ? 'offline' : 'occupied'));
  });
}

module.exports = { checkBackend };
