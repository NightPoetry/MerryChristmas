
/**
 * ============================================
 * 响应压缩中间件
 * ============================================
 * 自动压缩响应体以减少传输大小
 */

const compress = require('koa-compress');
const zlib = require('zlib');

const config = {
  level: ['global'],
  order: -3,  // 在格式化之后，错误处理之前
  enabled: true,
  description: '响应压缩'
};

function handler(ctx) {
  return compress({
    filter: (contentType) => {
      // 只压缩文本类型
      return /text|json|javascript|css|xml|svg/.test(contentType);
    },
    threshold: 1024,  // 只压缩大于 1KB 的响应
    gzip: {
      flush: zlib.constants.Z_SYNC_FLUSH
    },
    deflate: {
      flush: zlib.constants.Z_SYNC_FLUSH
    },
    br: false  // 禁用 Brotli（可根据需要启用）
  })(ctx);
}
