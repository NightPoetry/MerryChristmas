
/**
 * ============================================
 * MerryChristmas 服务器启动文件
 * ============================================
 * 
 * 功能：
 * - 启动 Koa 应用
 * - 加载中间件（body parser, static files 等）
 * - 初始化路由系统
 * - 错误处理
 * - 优雅关闭
 */

require('dotenv').config();
const Koa = require('koa');
const bodyParser = require('koa-bodyparser');
const serve = require('koa-static');
const path = require('path');
const { initializeRoutes } = require('./router/router');

// ============================================
// 应用配置
// ============================================

const app = new Koa();

const CONFIG = {
  port: process.env.PORT || 3000,
  host: process.env.HOST || '0.0.0.0',
  rootDomain: process.env.ROOT_DOMAIN || 'localhost',
  env: process.env.NODE_ENV || 'development',
  staticDir: path.join(__dirname, 'public')
};

// ============================================
// 全局错误处理
// ============================================

app.on('error', (err, ctx) => {
  console.error('服务器错误:', {
    message: err.message,
    stack: err.stack,
    url: ctx?.url,
    method: ctx?.method,
    status: err.status || 500
  });
});

// 未捕获的异常
process.on('uncaughtException', (error) => {
  console.error('未捕获的异常:', error);
  process.exit(1);
});

// 未处理的 Promise 拒绝
process.on('unhandledRejection', (reason, promise) => {
  console.error('未处理的 Promise 拒绝:', reason);
  process.exit(1);
});

// ============================================
// 基础中间件
// ============================================

// 1. 请求体解析
app.use(bodyParser({
  enableTypes: ['json', 'form', 'text'],
  jsonLimit: '10mb',
  formLimit: '10mb',
  textLimit: '10mb',
  onError: (err, ctx) => {
    ctx.throw(422, '请求体解析失败: ' + err.message);
  }
}));

// 2. 静态文件服务
app.use(serve(CONFIG.staticDir, {
  maxage: CONFIG.env === 'production' ? 1000 * 60 * 60 * 24 * 7 : 0, // 生产环境缓存7天
  hidden: false,
  index: 'index.html',
  defer: false,
  gzip: true
}));

// 3. 响应时间
app.use(async (ctx, next) => {
  const start = Date.now();
  await next();
  const ms = Date.now() - start;
  ctx.set('X-Response-Time', `${ms}ms`);
});

// 4. 基础安全头
app.use(async (ctx, next) => {
  ctx.set('X-Content-Type-Options', 'nosniff');
  ctx.set('X-Frame-Options', 'DENY');
  ctx.set('X-XSS-Protection', '1; mode=block');
  
  if (CONFIG.env === 'production') {
    ctx.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  
  await next();
});

// ============================================
// 初始化路由系统
// ============================================

let servers = [];

(async () => {
  try {
    console.log('\n============================================');
    console.log('🎄 MerryChristmas 服务器启动中...');
    console.log('============================================\n');
    console.log(`环境: ${CONFIG.env}`);
    console.log(`主机: ${CONFIG.host}`);
    console.log(`根域名: ${CONFIG.rootDomain}\n`);

    // 初始化路由系统（会扫描并加载所有路由和中间件）
    const { servers: additionalServers } = await initializeRoutes(app, {
      rootDomain: CONFIG.rootDomain,
      defaultPort: CONFIG.port
    });

    servers = additionalServers;

    // 启动主应用
    const mainServer = app.listen(CONFIG.port, CONFIG.host, () => {
      console.log('============================================');
      console.log('🎉 服务器启动成功！');
      console.log('============================================\n');
      console.log(`🌐 主服务: http://${CONFIG.rootDomain}:${CONFIG.port}`);
      
      if (additionalServers.length > 0) {
        console.log('\n📡 额外端口服务:');
        additionalServers.forEach(({ port }) => {
          console.log(`   - 端口 ${port}`);
        });
      }
      
      console.log('\n============================================');
      console.log('📝 可用路由:');
      console.log('   - http://localhost:' + CONFIG.port + ' (根域名)');
      console.log('   - http://api.localhost:' + CONFIG.port + ' (API)');
      console.log('   - http://admin.localhost:' + CONFIG.port + ' (管理)');
      console.log('============================================\n');
      
      if (CONFIG.env === 'development') {
        console.log('💡 提示: 开发模式已启用');
        console.log('   - 自动重载: 使用 nodemon');
        console.log('   - 调试信息: 已启用');
        console.log('   - 错误堆栈: 完整显示\n');
      }
    });

    mainServer.on('error', (error) => {
      if (error.code === 'EADDRINUSE') {
        console.error(`\n❌ 错误: 端口 ${CONFIG.port} 已被占用`);
        console.error('请尝试以下方法：');
        console.error('   1. 关闭占用该端口的程序');
        console.error(`   2. 使用其他端口: PORT=3001 node server.js\n`);
      } else {
        console.error('\n❌ 服务器启动失败:', error.message, '\n');
      }
      process.exit(1);
    });

    servers.push({ port: CONFIG.port, server: mainServer });

  } catch (error) {
    console.error('\n❌ 初始化失败:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
})();

// ============================================
// 优雅关闭
// ============================================

function gracefulShutdown(signal) {
  console.log(`\n\n收到 ${signal} 信号，正在优雅关闭...`);
  
  let closed = 0;
  const total = servers.length;

  servers.forEach(({ port, server }) => {
    server.close(() => {
      console.log(`✓ 端口 ${port} 已关闭`);
      closed++;
      
      if (closed === total) {
        console.log('✓ 所有服务已关闭');
        console.log('👋 再见！\n');
        process.exit(0);
      }
    });
  });

  // 强制关闭超时
  setTimeout(() => {
    console.error('⚠ 强制关闭（超时）');
    process.exit(1);
  }, 10000);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// ============================================
// 开发模式热重载支持
// ============================================

if (CONFIG.env === 'development' && module.hot) {
  module.hot.accept('./router/router', () => {
    console.log('🔄 路由系统热重载...');
  });
}

// ============================================
// 导出应用实例（用于测试）
// ============================================

module.exports = app;
