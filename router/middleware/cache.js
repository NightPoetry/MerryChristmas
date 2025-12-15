
/**
 * ============================================
 * 缓存中间件
 * ============================================
 * 基于路由配置的响应缓存
 */

const config = {
  level: ['public', 'protected'],
  order: 30,
  enabled: false,  // 🔒 默认禁用，需要时启用
  description: '响应缓存'
};

// 简单的内存缓存（生产环境建议使用 Redis）
const cache = new Map();

function before(ctx) {
  const routeConfig = ctx.state.routeConfig || {};
  
  // 检查路由是否启用缓存
  if (!routeConfig.cache || !routeConfig.cache.enabled) {
    return;
  }
  
  // 只缓存 GET 请求
  if (ctx.method !== 'GET') {
    return;
  }
  
  // 生成缓存 key
  const cacheKey = generateCacheKey(ctx);
  
  // 检查缓存
  const cached = cache.get(cacheKey);
  
  if (cached && Date.now() - cached.timestamp < routeConfig.cache.ttl * 1000) {
    // 缓存命中
    ctx.status = 200;
    ctx.body = cached.data;
    ctx.set('X-Cache', 'HIT');
    ctx.set('X-Cache-Age', Math.floor((Date.now() - cached.timestamp) / 1000).toString());
    
    console.log(`✓ 缓存命中: ${cacheKey}`);
    
    // 阻止后续处理
    ctx.state.cacheHit = true;
  } else {
    ctx.set('X-Cache', 'MISS');
    ctx.state.cacheKey = cacheKey;
  }
}

function after(ctx) {
  const routeConfig = ctx.state.routeConfig || {};
  
  // 跳过缓存命中的请求
  if (ctx.state.cacheHit) {
    return;
  }
  
  // 检查是否需要缓存
  if (!routeConfig.cache || !routeConfig.cache.enabled || !ctx.state.cacheKey) {
    return;
  }
  
  // 只缓存成功的响应
  if (ctx.status >= 200 && ctx.status < 300 && ctx.body) {
    cache.set(ctx.state.cacheKey, {
      data: ctx.body,
      timestamp: Date.now()
    });
    
    console.log(`✓ 已缓存: ${ctx.state.cacheKey} (TTL: ${routeConfig.cache.ttl}s)`);
  }
}

/**
 * 生成缓存 key
 */
function generateCacheKey(ctx) {
  const parts = [
    ctx.path,
    JSON.stringify(ctx.query),
    ctx.user?.id || 'anonymous'
  ];
  
  return parts.join(':');
}

// 定期清理过期缓存
setInterval(() => {
  const now = Date.now();
  let cleaned = 0;
  
  for (const [key, value] of cache.entries()) {
    // 清理超过1小时的缓存
    if (now - value.timestamp > 3600000) {
      cache.delete(key);
      cleaned++;
    }
  }
  
  if (cleaned > 0) {
    console.log(`🗑️ 清理过期缓存: ${cleaned} 条`);
  }
}, 600000); // 每10分钟清理一次
