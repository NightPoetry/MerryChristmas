
/**
 * ============================================
 * 错误处理中间件
 * ============================================
 * 统一的错误处理和响应格式化
 */

const config = {
  level: ['global'],
  order: -1,  // 最后执行
  enabled: true,
  description: '全局错误处理'
};

function onError(ctx, error) {
  // 确定状态码
  const status = error.statusCode || error.status || 500;
  
  // 构建错误响应
  const errorResponse = {
    success: false,
    error: {
      code: error.code || getErrorCode(status),
      message: error.message || '服务器内部错误',
      status
    }
  };
  
  // 开发环境返回详细错误信息
  if (process.env.NODE_ENV === 'development') {
    errorResponse.error.stack = error.stack;
    errorResponse.error.details = error.details;
  }
  
  // 记录错误日志
  if (status >= 500) {
    console.error('❌ 服务器错误:', {
      message: error.message,
      stack: error.stack,
      url: ctx.url,
      method: ctx.method,
      user: ctx.user?.id,
      body: ctx.request.body
    });
  } else if (status >= 400) {
    console.warn('⚠ 客户端错误:', {
      message: error.message,
      url: ctx.url,
      method: ctx.method,
      status
    });
  }
  
  // 设置响应
  ctx.status = status;
  ctx.body = errorResponse;
}

/**
 * 根据状态码获取错误代码
 */
function getErrorCode(status) {
  const codes = {
    400: 'BAD_REQUEST',
    401: 'UNAUTHORIZED',
    403: 'FORBIDDEN',
    404: 'NOT_FOUND',
    405: 'METHOD_NOT_ALLOWED',
    409: 'CONFLICT',
    422: 'UNPROCESSABLE_ENTITY',
    429: 'TOO_MANY_REQUESTS',
    500: 'INTERNAL_SERVER_ERROR',
    502: 'BAD_GATEWAY',
    503: 'SERVICE_UNAVAILABLE'
  };
  
  return codes[status] || 'UNKNOWN_ERROR';
}
