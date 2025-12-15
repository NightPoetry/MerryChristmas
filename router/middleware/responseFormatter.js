
/**
 * ============================================
 * 响应格式化中间件
 * ============================================
 * 统一的响应格式
 */

const config = {
  level: ['global'],
  order: -2,  // 倒数第二个执行
  enabled: true,
  exclude: ['/health', '/ping'],
  description: '统一响应格式'
};

function after(ctx) {
  // 跳过已格式化的响应
  if (!ctx.body) {
    return;
  }
  
  // 跳过已经是标准格式的响应
  if (typeof ctx.body === 'object' && 'success' in ctx.body) {
    return;
  }
  
  // 跳过文件下载等特殊响应
  if (ctx.body instanceof Buffer || ctx.body instanceof Stream) {
    return;
  }
  
  // 统一包装
  const wrapped = {
    success: true,
    data: ctx.body,
    timestamp: Date.now()
  };
  
  // 添加分页信息（如果有）
  if (ctx.state.pagination) {
    wrapped.pagination = ctx.state.pagination;
  }
  
  ctx.body = wrapped;
}
