
/**
 * ============================================
 * 限流中间件
 * ============================================
 * 基于路由配置的请求限流
 */

const config = {
  level: ['public', 'protected'],
  order: 20,
  enabled: false,  // 🔒 默认禁用，需要时启用
  description: 'API 请求限流'
};

// 简单的内存存储（生产环境建议使用 Redis）
const requestCounts = new Map();

function handler(ctx) {
  const routeConfig = ctx.state.routeConfig || {};
  
  // 检查路由是否配置了限流
  if (!routeConfig.rateLimit) {
    return;
  }
  
  const { max, windowMs } = routeConfig.rateLimit;
  
  // 生成限流 key（基于用户 ID 或 IP）
  const identifier = ctx.user?.id || ctx.ip;
  const key = `${ctx.path}:${identifier}`;
  
  // 获取当前计数
  const now = Date.now();
  let record = requestCounts.get(key);
  
  if (!record || now - record.resetTime > windowMs) {
    // 创建新记录
    record = {
      count: 0,
      resetTime: now
    };
  }
  
  // 增加计数
  record.count++;
  requestCounts.set(key, record);
  
  // 设置响应头
  ctx.set('X-RateLimit-Limit', max.toString());
  ctx.set('X-RateLimit-Remaining', Math.max(0, max - record.count).toString());
  ctx.set('X-RateLimit-Reset', new Date(record.resetTime + windowMs).toISOString());
  
  // 检查是否超限
  if (record.count > max) {
    const retryAfter = Math.ceil((record.resetTime + windowMs - now) / 1000);
    ctx.set('Retry-After', retryAfter.toString());
    
    ctx.throw(429, '请求过于频繁，请稍后再试', {
      code: 'RATE_LIMIT_EXCEEDED',
      retryAfter
    });
  }
  
  console.log(`🚦 限流检查: ${key} (${record.count}/${max})`);
}

// 定期清理过期记录（可选）
setInterval(() => {
  const now = Date.now();
  for (const [key, record] of requestCounts.entries()) {
    if (now - record.resetTime > 3600000) { // 1小时
      requestCounts.delete(key);
    }
  }
}, 300000); // 每5分钟清理一次
