
/**
 * ============================================
 * JWT 认证中间件
 * ============================================
 * 验证 JWT Token 并注入用户信息
 */

const jwt = require('jsonwebtoken');

const config = {
  level: ['protected'],
  order: 40,
  enabled: true,
  exclude: ['/auth/refresh', '/auth/logout'],
  description: 'JWT 身份验证'
};

function handler(ctx) {
  // 从 Header 中获取 Token
  const authHeader = ctx.get('Authorization');
  
  if (!authHeader) {
    ctx.throw(401, '缺少认证令牌', { code: 'NO_TOKEN' });
  }
  
  // 支持 "Bearer token" 格式
  const token = authHeader.startsWith('Bearer ') 
    ? authHeader.slice(7) 
    : authHeader;
  
  if (!token) {
    ctx.throw(401, '认证令牌格式错误', { code: 'INVALID_TOKEN_FORMAT' });
  }
  
  try {
    // 验证 Token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // 检查 Token 是否过期
    if (decoded.exp && decoded.exp < Date.now() / 1000) {
      ctx.throw(401, '令牌已过期', { code: 'TOKEN_EXPIRED' });
    }
    
    // 注入用户信息到上下文
    ctx.user = {
      id: decoded.id,
      username: decoded.username,
      roles: decoded.roles || [],
      permissions: decoded.permissions || []
    };
    
    // 记录最后访问时间（可选）
    ctx.state.lastAccessTime = Date.now();
    
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      ctx.throw(401, '令牌已过期', { code: 'TOKEN_EXPIRED' });
    } else if (error.name === 'JsonWebTokenError') {
      ctx.throw(401, '无效的令牌', { code: 'INVALID_TOKEN' });
    } else {
      ctx.throw(401, '令牌验证失败', { code: 'TOKEN_VALIDATION_FAILED' });
    }
  }
}


// 导出中间件，符合npm包规范
module.exports = {
  config
};