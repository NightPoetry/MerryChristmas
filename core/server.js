const Koa = require('koa');
const { initializeRoutes } = require('./router');
const fs = require('fs');
const path = require('path');

// 加载所有内置中间件
function loadBuiltinMiddlewares() {
  const middlewareDir = path.join(__dirname, 'middleware');
  const middlewareFiles = fs.readdirSync(middlewareDir);
  const middleware = {};

  middlewareFiles.forEach(file => {
    if (file.endsWith('.js')) {
      const middlewareName = file.replace('.js', '');
      try {
        const middlewarePath = path.join(middlewareDir, file);
        
        // 使用router.js中的loadMiddlewareFile函数来加载中间件
        // 这里我们简化处理，直接执行中间件文件并提取配置和函数
        const code = fs.readFileSync(middlewarePath, 'utf-8');
        const fullCode = `
          (function() {
            const extracted = {};
            ${code}
            if (typeof config !== 'undefined') extracted.config = config;
            if (typeof handler !== 'undefined') extracted.handler = handler;
            if (typeof before !== 'undefined') extracted.before = before;
            if (typeof after !== 'undefined') extracted.after = after;
            if (typeof onRequest !== 'undefined') extracted.onRequest = onRequest;
            if (typeof onResponse !== 'undefined') extracted.onResponse = onResponse;
            if (typeof onError !== 'undefined') extracted.onError = onError;
            if (typeof onFinish !== 'undefined') extracted.onFinish = onFinish;
            return extracted;
          })()`;
        
        const sandbox = {
          console,
          require,
          process,
          __dirname: middlewareDir,
          __filename: middlewarePath,
          Buffer,
          setTimeout,
          setInterval,
          clearTimeout,
          clearInterval
        };
        
        const vm = require('vm');
        const script = new vm.Script(fullCode);
        const middlewareModule = script.runInNewContext(sandbox);
        
        middleware[middlewareName] = middlewareModule;
      } catch (error) {
        console.error(`⚠ 加载内置中间件 ${middlewareName} 失败:`, error.message);
      }
    }
  });

  return middleware;
}

// 加载内置中间件
const middleware = loadBuiltinMiddlewares();

class MerryChristmasServer {
  constructor(options = {}) {
    this.options = {
      port: options.port || 3000,
      host: options.host || '0.0.0.0',
      rootDomain: options.rootDomain || 'localhost',
      env: options.env || 'development',
      ...options
    };
    
    this.app = new Koa();
    this.servers = [];
  }

  async start() {
    try {
      console.log(`🎄 MerryChristmas Server starting in ${this.options.env} mode...`);
      console.log(`📡 Listening on ${this.options.host}:${this.options.port}`);
      console.log(`🌐 Root domain: ${this.options.rootDomain}`);

      // 初始化路由系统
      const { servers, portApps } = await initializeRoutes(this.app, {
        rootDomain: this.options.rootDomain,
        defaultPort: this.options.port
      });

      // 启动默认端口服务器
      const defaultServer = this.app.listen(this.options.port, this.options.host, () => {
        console.log(`✅ 服务器已启动在 ${this.options.host}:${this.options.port}`);
      });

      this.servers = [defaultServer, ...servers];
      
      return this.servers;
    } catch (error) {
      console.error('❌ 服务器启动失败:', error.message);
      throw error;
    }
  }

  stop() {
    this.servers.forEach(server => {
      server.close();
    });
    console.log('🛑 服务器已停止');
  }

  getApp() {
    return this.app;
  }

  // 添加getConfig方法，方便获取配置
  getConfig() {
    return this.options;
  }
}

// 导出中间件和服务器类
module.exports = MerryChristmasServer;
module.exports.middleware = middleware;
module.exports.default = MerryChristmasServer;
