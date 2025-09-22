#!/usr/bin/env node
const http = require('node:http');

async function findAvailablePort(startPort, attempts = 20) {
  let port = startPort;
  while (port < startPort + attempts) {
    const isFree = await new Promise((resolve) => {
      const tester = http.createServer();
      tester.once('error', () => {
        tester.close();
        resolve(false);
      });
      tester.once('listening', () => {
        tester.close(() => resolve(true));
      });
      tester.listen(port, '0.0.0.0');
    });
    if (isFree) {
      return port;
    }
    port += 1;
  }
  throw new Error(`Kein freier Port im Bereich ${startPort}–${startPort + attempts} gefunden.`);
}

module.exports = {
  findAvailablePort
};
