
/**
 * ============================================
 * 日志中间件
 * ============================================
 * 记录所有 HTTP 请求的详细信息
 */

const config = {
  level: ['global'],
  order: 1,
  enabled: true,
  description: '请求日志记录'
};

function handler(ctx) {
  const start = Date.now();
  const { method, url, ip } = ctx;
  
  console.log(`→ ${method} ${url} from ${ip}`);
  
  // 响应完成后记录
  ctx.res.on('finish', () => {
    const duration = Date.now() - start;
    const { status } = ctx;
    
    // 根据状态码选择日志级别
    const statusSymbol = status >= 500 ? '✗' : 
                        status >= 400 ? '⚠' : 
                        status >= 300 ? '↪' : '✓';
    
    console.log(`${statusSymbol} ${method} ${url} ${status} ${duration}ms`);
  });
}
