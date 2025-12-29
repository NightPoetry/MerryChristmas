const http = require('http');

const hostname = '127.0.0.1';
const port = 3001;

const server = http.createServer((req, res) => {
  res.statusCode = 200;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify({
    message: 'Hello, World!',
    path: req.url,
    method: req.method
  }));
});

server.listen(port, hostname, () => {
  console.log(`✅ 纯Node.js服务器已启动在 http://${hostname}:${port}/`);
  console.log(`📡 测试路由: GET http://${hostname}:${port}/hello`);
});

// 保持进程运行
process.stdin.resume();