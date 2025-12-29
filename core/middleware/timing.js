// 洋葱模式中间件 - 记录请求处理时间

const config = {
  level: ['global'],
  order: 3,
  description: '请求计时中间件'
};

function before(ctx) {
  ctx.state.startTime = Date.now();
  console.log(`[计时] 开始: ${ctx.method} ${ctx.url}`);
}

function after(ctx) {
  const duration = Date.now() - ctx.state.startTime;
  console.log(`[计时] 结束: ${ctx.method} ${ctx.url} - ${duration}ms`);
  ctx.set('X-Response-Time', `${duration}ms`);
}
