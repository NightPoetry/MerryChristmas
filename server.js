/**
 * ============================================
 * MerryChristmas 项目入口文件
 * ============================================
 * 
 * 功能：
 * - 作为项目的入口文件
 * - 实例化核心服务器组件
 * - 启动服务器
 */

// 引用核心服务器模块
const MerryChristmasServer = require('./core/server');

// 实例化服务器
const server = new MerryChristmasServer({
  port: process.env.PORT || 3000,
  host: process.env.HOST || '0.0.0.0',
  rootDomain: process.env.ROOT_DOMAIN || 'localhost',
  env: process.env.NODE_ENV || 'development'
});

// 启动服务器
server.start()
  .then(servers => {
    console.log('✅ 服务器启动成功');
  })
  .catch(error => {
    console.error('❌ 服务器启动失败:', error.message);
    process.exit(1);
  });

// 导出服务器实例
module.exports = server;
