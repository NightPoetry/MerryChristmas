
/**
 * ============================================
 * 请求体验证中间件
 * ============================================
 * 基于路由配置验证请求体
 */

const config = {
  level: ['protected', 'public'],
  order: 45,
  enabled: false,  // 🔒 默认禁用，需要时启用
  description: '请求体数据验证'
};

function before(ctx) {
  const routeConfig = ctx.state.routeConfig || {};
  
  // 检查是否配置了验证规则
  if (!routeConfig.validate) {
    return;
  }
  
  const { body } = ctx.request;
  const { validate } = routeConfig;
  
  // 验证必填字段
  if (validate.required) {
    for (const field of validate.required) {
      if (body[field] === undefined || body[field] === null || body[field] === '') {
        ctx.throw(400, `缺少必填字段: ${field}`, {
          code: 'MISSING_REQUIRED_FIELD',
          field
        });
      }
    }
  }
  
  // 验证字段类型
  if (validate.types) {
    for (const [field, expectedType] of Object.entries(validate.types)) {
      if (body[field] !== undefined) {
        const actualType = typeof body[field];
        
        if (actualType !== expectedType) {
          ctx.throw(400, `字段类型错误: ${field} 应为 ${expectedType}`, {
            code: 'INVALID_FIELD_TYPE',
            field,
            expected: expectedType,
            actual: actualType
          });
        }
      }
    }
  }
  
  // 验证字段长度
  if (validate.length) {
    for (const [field, constraint] of Object.entries(validate.length)) {
      const value = body[field];
      
      if (value !== undefined) {
        const length = typeof value === 'string' ? value.length : value.toString().length;
        
        if (constraint.min !== undefined && length < constraint.min) {
          ctx.throw(400, `字段 ${field} 长度不足，最少 ${constraint.min} 个字符`, {
            code: 'FIELD_TOO_SHORT',
            field,
            min: constraint.min
          });
        }
        
        if (constraint.max !== undefined && length > constraint.max) {
          ctx.throw(400, `字段 ${field} 长度超限，最多 ${constraint.max} 个字符`, {
            code: 'FIELD_TOO_LONG',
            field,
            max: constraint.max
          });
        }
      }
    }
  }
  
  // 验证正则表达式
  if (validate.patterns) {
    for (const [field, pattern] of Object.entries(validate.patterns)) {
      const value = body[field];
      
      if (value !== undefined && !pattern.test(value)) {
        ctx.throw(400, `字段 ${field} 格式不正确`, {
          code: 'INVALID_FIELD_FORMAT',
          field
        });
      }
    }
  }
  
  // 自定义验证函数
  if (validate.custom && typeof validate.custom === 'function') {
    try {
      validate.custom(body);
    } catch (error) {
      ctx.throw(400, error.message, {
        code: 'CUSTOM_VALIDATION_FAILED'
      });
    }
  }
  
  console.log('✓ 请求体验证通过');
}


// 导出中间件，符合npm包规范
module.exports = {
  config,
  before
};