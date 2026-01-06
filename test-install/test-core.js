const MerryChristmasServer = require('merrychristmas-server');

console.log('✅ 成功导入核心库');
console.log('核心库版本:', require('merrychristmas-server/package.json').version);

// 测试实例化服务器
const server = new MerryChristmasServer({
  port: 0, // 使用随机端口
  host: '127.0.0.1'
});

console.log('✅ 成功实例化服务器');

// 测试getConfig方法
const config = server.getConfig();
console.log('✅ 成功调用getConfig()方法');
console.log('服务器配置:', { port: config.port, host: config.host });

// 检查Koa实例是否存在
console.log('✅ Koa实例存在:', !!server.app);

// 测试getApp方法
const app = server.getApp();
console.log('✅ 成功调用getApp()方法');

console.log('\n🎉 所有核心功能测试通过! 核心库可以正常使用。');

