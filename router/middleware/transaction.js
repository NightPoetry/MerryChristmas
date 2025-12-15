
/**
 * ============================================
 * 数据库事务中间件
 * ============================================
 * 自动管理数据库事务的生命周期
 */

const config = {
  level: ['protected'],
  order: 60,
  enabled: false,  // 🔒 默认禁用，需要时启用
  exclude: ['/health', '/metrics', '/ping'],
  description: '数据库事务管理'
};

// 这里需要引入你的数据库模块
// const db = require('../../modules/database');

function before(ctx) {
  const routeConfig = ctx.state.routeConfig || {};
  
  // 检查路由是否需要事务（默认需要）
  if (routeConfig.transaction === false) {
    console.log('⊘ 路由禁用事务，跳过');
    return;
  }
  
  try {
    // 开启事务
    // ctx.transaction = await db.beginTransaction();
    
    // 模拟事务对象（实际使用时替换为真实的数据库连接）
    ctx.transaction = {
      query: async (sql, params) => {
        console.log('🔍 执行查询:', sql);
        // return await db.query(sql, params);
        return []; // 模拟返回
      },
      commit: async () => {
        console.log('✓ 事务提交');
        // await db.commit();
      },
      rollback: async () => {
        console.log('✗ 事务回滚');
        // await db.rollback();
      }
    };
    
    ctx.state.transactionActive = true;
    console.log('→ 事务已开启');
    
  } catch (error) {
    console.error('✗ 开启事务失败:', error.message);
    ctx.throw(500, '数据库事务开启失败');
  }
}

function after(ctx) {
  if (!ctx.state.transactionActive) {
    return;
  }
  
  try {
    // 根据响应状态决定提交或回滚
    if (ctx.status >= 200 && ctx.status < 400) {
      ctx.transaction.commit();
      console.log('✓ 事务已提交');
    } else {
      ctx.transaction.rollback();
      console.log('✗ 事务已回滚（响应状态: ' + ctx.status + '）');
    }
  } catch (error) {
    console.error('✗ 事务处理失败:', error.message);
  }
}

function onError(ctx, error) {
  if (ctx.state.transactionActive) {
    try {
      ctx.transaction.rollback();
      console.log('✗ 事务已回滚（发生错误）');
    } catch (rollbackError) {
      console.error('✗ 事务回滚失败:', rollbackError.message);
    }
  }
}
