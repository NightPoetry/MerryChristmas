// 简单模式中间件 - 记录请求信息

const config = {
  level: ['global'],
  order: 2,
  description: '简单日志中间件'
};

function handler(ctx) {
  console.log(`[简单日志] ${ctx.method} ${ctx.url} - ${ctx.ip}`);
}
