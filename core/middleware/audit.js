
/**
 * ============================================
 * 审计日志中间件
 * ============================================
 * 记录用户操作的审计日志
 */

const fs = require('fs');
const path = require('path');

const config = {
  level: ['protected'],
  order: 2,
  enabled: false,  // 🔒 默认禁用，需要时启用
  exclude: ['/health', '/metrics', '/ping'],
  description: '用户操作审计日志'
};

const auditLogPath = path.join(__dirname, '../../storage/audit.log');

function before(ctx) {
  const routeConfig = ctx.state.routeConfig || {};
  
  // 检查是否需要审计
  if (!routeConfig.audit) {
    return;
  }
  
  // 收集审计信息
  ctx.state.audit = {
    timestamp: new Date().toISOString(),
    userId: ctx.user?.id || 'anonymous',
    username: ctx.user?.username || 'anonymous',
    ip: ctx.ip,
    method: ctx.method,
    url: ctx.url,
    path: ctx.path,
    action: routeConfig.auditAction || 'UNKNOWN_ACTION',
    userAgent: ctx.get('User-Agent'),
    requestBody: sanitizeBody(ctx.request.body),
    changes: null,
    success: null,
    status: null,
    errorMessage: null,
    duration: null
  };
  
  ctx.state.auditStartTime = Date.now();
  
  console.log(`📋 审计记录开始: ${ctx.state.audit.action} by ${ctx.state.audit.username}`);
}

function after(ctx) {
  if (!ctx.state.audit) {
    return;
  }
  
  // 更新审计信息
  ctx.state.audit.status = ctx.status;
  ctx.state.audit.success = ctx.status >= 200 && ctx.status < 400;
  ctx.state.audit.duration = Date.now() - ctx.state.auditStartTime;
  
  // 获取路由中记录的变更信息
  if (ctx.state.auditChanges) {
    ctx.state.audit.changes = ctx.state.auditChanges;
  }
  
  console.log(`📋 审计记录完成: ${ctx.state.audit.action} - ${ctx.state.audit.success ? '✓' : '✗'}`);
}

function onFinish(ctx) {
  if (!ctx.state.audit) {
    return;
  }
  
  // 异步写入审计日志
  writeAuditLog(ctx.state.audit);
}

function onError(ctx, error) {
  if (!ctx.state.audit) {
    return;
  }
  
  // 记录错误信息
  ctx.state.audit.success = false;
  ctx.state.audit.errorMessage = error.message;
  ctx.state.audit.status = error.status || 500;
  ctx.state.audit.duration = Date.now() - ctx.state.auditStartTime;
  
  console.log(`📋 审计记录失败: ${ctx.state.audit.action} - ${error.message}`);
}

/**
 * 清理敏感数据
 */
function sanitizeBody(body) {
  if (!body || typeof body !== 'object') {
    return body;
  }
  
  const sanitized = { ...body };
  
  // 移除敏感字段
  const sensitiveFields = ['password', 'token', 'secret', 'apiKey'];
  sensitiveFields.forEach(field => {
    if (sanitized[field]) {
      sanitized[field] = '***';
    }
  });
  
  return sanitized;
}

/**
 * 写入审计日志
 */
function writeAuditLog(audit) {
  try {
    const logEntry = JSON.stringify(audit) + '\n';
    
    // 确保目录存在
    const dir = path.dirname(auditLogPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    // 追加写入日志文件
    fs.appendFileSync(auditLogPath, logEntry);
    
    // 可选：同时写入数据库
    // await db.query('INSERT INTO audit_logs SET ?', audit);
    
  } catch (error) {
    console.error('✗ 写入审计日志失败:', error.message);
  }
}


// 导出中间件，符合npm包规范
module.exports = {
  config,
  before,
  after,
  onError,
  onFinish
};