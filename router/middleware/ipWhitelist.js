
/**
 * ============================================
 * IP 白名单中间件
 * ============================================
 * 限制只有白名单 IP 可以访问（用于 private 路由）
 */

const config = {
  level: ['private'],
  order: 5,
  enabled: false,  // 🔒 默认禁用，需要时启用
  description: 'IP 白名单验证'
};

// IP 白名单配置
const whitelist = [
  '127.0.0.1',
  '::1',
  'localhost',
  // 添加更多允许的 IP
  // '192.168.1.100',
];

function handler(ctx) {
  const clientIp = getClientIp(ctx);
  
  // 检查是否在白名单中
  if (!isIpWhitelisted(clientIp)) {
    console.warn(`⚠ IP 访问被拒绝: ${clientIp}`);
    ctx.throw(403, '访问被拒绝：IP 不在白名单中', {
      code: 'IP_NOT_WHITELISTED',
      ip: clientIp
    });
  }
  
  console.log(`✓ IP 白名单验证通过: ${clientIp}`);
}

/**
 * 获取客户端真实 IP
 */
function getClientIp(ctx) {
  // 尝试从代理头获取
  const forwarded = ctx.get('X-Forwarded-For');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  
  const realIp = ctx.get('X-Real-IP');
  if (realIp) {
    return realIp;
  }
  
  return ctx.ip;
}

/**
 * 检查 IP 是否在白名单中
 */
function isIpWhitelisted(ip) {
  // IPv6 localhost 转换
  if (ip === '::1' || ip === '::ffff:127.0.0.1') {
    return true;
  }
  
  return whitelist.some(allowed => {
    if (allowed.includes('*')) {
      // 支持通配符，如 192.168.1.*
      const pattern = allowed.replace(/\./g, '\\.').replace(/\*/g, '\\d+');
      const regex = new RegExp(`^${pattern}$`);
      return regex.test(ip);
    }
    return allowed === ip;
  });
}
