// 生命周期模式中间件 - 监控请求完整生命周期

const config = {
  level: ['global'],
  order: 4,
  description: '生命周期监控中间件'
};

function onRequest(ctx) {
  console.log(`[生命周期] 请求开始: ${ctx.method} ${ctx.url}`);
  ctx.state.requestId = Math.random().toString(36).substr(2, 9);
  ctx.set('X-Request-Id', ctx.state.requestId);
}

function before(ctx) {
  console.log(`[生命周期] 处理前: ${ctx.state.requestId}`);
}

function after(ctx) {
  console.log(`[生命周期] 处理后: ${ctx.state.requestId}`);
}

function onResponse(ctx) {
  console.log(`[生命周期] 响应发送: ${ctx.state.requestId} - ${ctx.status}`);
}

function onError(ctx, error) {
  console.error(`[生命周期] 错误发生: ${ctx.state.requestId} - ${error.message}`);
}

function onFinish(ctx) {
  console.log(`[生命周期] 请求完成: ${ctx.state.requestId}`);
}
