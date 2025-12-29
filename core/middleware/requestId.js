
/**
 * ============================================
 * 请求 ID 中间件
 * ============================================
 * 为每个请求生成唯一 ID，便于追踪
 */

const crypto = require('crypto');

const config = {
  level: ['global'],
  order: 0,  // 最先执行
  enabled: true,
  description: '请求 ID 生成'
};

function handler(ctx) {
  // 检查是否已有请求 ID（可能来自上游代理）
  let requestId = ctx.get('X-Request-ID');
  
  if (!requestId) {
    // 生成新的请求 ID
    requestId = generateRequestId();
  }
  
  // 注入到上下文
  ctx.state.requestId = requestId;
  
  // 设置响应头
  ctx.set('X-Request-ID', requestId);
  
  console.log(`🆔 请求 ID: ${requestId}`);
}

/**
 * 生成请求 ID
 */
function generateRequestId() {
  const timestamp = Date.now().toString(36);
  const random = crypto.randomBytes(6).toString('hex');
  return `${timestamp}-${random}`;
}


// 导出中间件，符合npm包规范
module.exports = {
  config
};