const Koa = require('koa');
const Router = require('@koa/router');

// 创建 Koa 应用
const app = new Koa();
const router = new Router();

// 添加一个简单的路由
router.get('/hello', async (ctx) => {
  ctx.body = {
    message: 'Hello, MerryChristmas!',
    timestamp: new Date().toISOString(),
    path: ctx.path,
    method: ctx.method
  };
});

// 使用路由
app.use(router.routes());
app.use(router.allowedMethods());

// 启动服务器
const port = 3001;
const server = app.listen(port, () => {
  console.log(`✅ 简单服务器已启动在 http://localhost:${port}`);
  console.log(`📡 测试路由: GET http://localhost:${port}/hello`);
});

// 导出服务器实例
module.exports = server;