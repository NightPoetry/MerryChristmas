const Koa = require('koa');
const { initializeRoutes } = require('./router');

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
}

module.exports = MerryChristmasServer;