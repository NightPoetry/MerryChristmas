
/**
 * ============================================
 * 性能监控中间件
 * ============================================
 * 监控请求性能并记录慢请求
 */

const config = {
  level: ['global'],
  order: 1,
  enabled: false,  // 🔒 默认禁用，需要时启用
  description: '性能监控和慢请求记录'
};

const SLOW_REQUEST_THRESHOLD = 1000; // 1秒

function onRequest(ctx) {
  ctx.state.perf = {
    start: Date.now(),
    marks: {}
  };
}

function before(ctx) {
  if (ctx.state.perf) {
    ctx.state.perf.marks.beforeBusiness = Date.now();
  }
}

function after(ctx) {
  if (ctx.state.perf) {
    ctx.state.perf.marks.afterBusiness = Date.now();
  }
}

function onResponse(ctx) {
  if (!ctx.state.perf) {
    return;
  }
  
  const perf = ctx.state.perf;
  const total = Date.now() - perf.start;
  const business = perf.marks.afterBusiness - perf.marks.beforeBusiness;
  const middleware = total - business;
  
  // 设置性能头
  ctx.set('X-Response-Time', `${total}ms`);
  ctx.set('X-Business-Time', `${business}ms`);
  ctx.set('X-Middleware-Time', `${middleware}ms`);
  
  // 记录慢请求
  if (total > SLOW_REQUEST_THRESHOLD) {
    console.warn(`🐌 慢请求警告: ${ctx.method} ${ctx.url}`);
    console.warn(`   总时间: ${total}ms (业务: ${business}ms, 中间件: ${middleware}ms)`);
  }
  
  // 记录性能数据
  ctx.state.perfData = {
    url: ctx.url,
    method: ctx.method,
    total,
    business,
    middleware,
    status: ctx.status
  };
}

function onFinish(ctx) {
  if (ctx.state.perfData) {
    // 异步发送到监控系统
    sendToMonitoring(ctx.state.perfData);
  }
}

function sendToMonitoring(data) {
  // 这里可以发送到监控系统（如 Prometheus、Grafana 等）
  // console.log('📊 性能数据:', data);
}


// 导出中间件，符合npm包规范
module.exports = {
  config,
  before,
  after,
  onRequest,
  onResponse,
  onFinish
};