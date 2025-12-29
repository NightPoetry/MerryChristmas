
/**
 * ============================================
 * 权限鉴定中间件
 * ============================================
 * 基于角色和权限的访问控制
 */

const config = {
  level: ['protected'],
  order: 50,
  enabled: false,  // 🔒 默认禁用，需要时启用
  description: '角色和权限验证'
};

function before(ctx) {
  const routeConfig = ctx.state.routeConfig || {};
  const user = ctx.user;
  
  if (!user) {
    ctx.throw(401, '未认证用户', { code: 'UNAUTHENTICATED' });
  }
  
  // ========== 角色验证 ==========
  if (routeConfig.requireRoles && routeConfig.requireRoles.length > 0) {
    const userRoles = user.roles || [];
    
    // 检查是否有任一所需角色
    const hasRequiredRole = routeConfig.requireRoles.some(role =>
      userRoles.includes(role)
    );
    
    if (!hasRequiredRole) {
      ctx.throw(403, '权限不足：缺少所需角色', {
        code: 'INSUFFICIENT_ROLE',
        required: routeConfig.requireRoles,
        current: userRoles
      });
    }
    
    console.log(`✓ 角色验证通过: ${userRoles.join(', ')}`);
  }
  
  // ========== 权限验证 ==========
  if (routeConfig.requirePermissions && routeConfig.requirePermissions.length > 0) {
    const userPermissions = user.permissions || [];
    
    // 检查是否拥有所有所需权限
    const hasAllPermissions = routeConfig.requirePermissions.every(permission =>
      userPermissions.includes(permission)
    );
    
    if (!hasAllPermissions) {
      const missingPermissions = routeConfig.requirePermissions.filter(
        permission => !userPermissions.includes(permission)
      );
      
      ctx.throw(403, '权限不足：缺少所需权限', {
        code: 'INSUFFICIENT_PERMISSION',
        missing: missingPermissions
      });
    }
    
    console.log(`✓ 权限验证通过: ${routeConfig.requirePermissions.join(', ')}`);
  }
}

function after(ctx) {
  const routeConfig = ctx.state.routeConfig || {};
  
  // ========== 数据脱敏 ==========
  if (ctx.body && routeConfig.sensitiveFields) {
    ctx.body = maskSensitiveData(
      ctx.body,
      routeConfig.sensitiveFields,
      ctx.user.roles
    );
  }
}

/**
 * 数据脱敏函数
 */
function maskSensitiveData(data, sensitiveFields, userRoles) {
  if (!data || typeof data !== 'object') {
    return data;
  }
  
  // 处理数组
  if (Array.isArray(data)) {
    return data.map(item => maskSensitiveData(item, sensitiveFields, userRoles));
  }
  
  // 处理对象
  const result = { ...data };
  
  for (const [field, allowedRoles] of Object.entries(sensitiveFields)) {
    // 检查用户是否有权查看此字段
    const hasPermission = userRoles.some(role => allowedRoles.includes(role));
    
    if (!hasPermission && result[field] !== undefined) {
      // 脱敏处理
      if (typeof result[field] === 'string') {
        if (field === 'email') {
          // 邮箱脱敏: user@example.com -> u***@example.com
          result[field] = result[field].replace(/^(.).+(@.+)$/, '$1***$2');
        } else if (field === 'phone') {
          // 手机号脱敏: 13812345678 -> 138****5678
          result[field] = result[field].replace(/(\d{3})\d{4}(\d{4})/, '$1****$2');
        } else if (field === 'idCard') {
          // 身份证脱敏: 110101199001011234 -> 110101********1234
          result[field] = result[field].replace(/^(.{6}).+(.{4})$/, '$1********$2');
        } else {
          // 默认脱敏
          result[field] = '***';
        }
      } else {
        result[field] = '***';
      }
    }
  }
  
  return result;
}


// 导出中间件，符合npm包规范
module.exports = {
  config,
  before,
  after
};