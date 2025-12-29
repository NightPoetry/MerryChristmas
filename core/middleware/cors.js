
/**
 * ============================================
 * CORS 跨域中间件
 * ============================================
 * 处理跨域请求
 */

const config = {
  level: ['global'],
  order: 10,
  enabled: true,
  description: 'CORS 跨域处理'
};

async function handler(ctx) {
  const origin = ctx.get('Origin');
  
  // 允许的源列表
  const allowedOrigins = [
    'http://localhost:3000',
    'http://localhost:3001',
    'http://localhost:8080',
    'https://example.com'
  ];
  
  // 开发环境允许所有源
  if (process.env.NODE_ENV === 'development') {
    ctx.set('Access-Control-Allow-Origin', origin || '*');
  } else {
    // 生产环境只允许白名单
    if (allowedOrigins.includes(origin)) {
      ctx.set('Access-Control-Allow-Origin', origin);
    }
  }
  
  ctx.set('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  ctx.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  ctx.set('Access-Control-Allow-Credentials', 'true');
  ctx.set('Access-Control-Max-Age', '86400'); // 24小时
  
  // 处理 OPTIONS 预检请求
  if (ctx.method === 'OPTIONS') {
    ctx.status = 204;
    return;
  }
}

// 导出中间件，符合npm包规范
module.exports = {
  config,
  handler
};
