
const fs = require('fs');
const path = require('path');
const Koa = require('koa');
const Router = require('@koa/router');
const vm = require('vm');

/**
 * ============================================
 * 中间件加载器
 * ============================================
 */

function detectMiddlewareType(module) {
  if (module.onRequest || module.onResponse || module.onError || module.onFinish) {
    return 'lifecycle';
  }
  if (module.before || module.after) {
    return 'onion';
  }
  if (module.handler) {
    return 'simple';
  }
  throw new Error('无效的中间件格式');
}

/**
 * 加载并标准化中间件模块
 */
function loadMiddlewareFile(filePath) {
  try {
    // 读取文件内容
    const code = fs.readFileSync(filePath, 'utf-8');
    
    // 使用函数包装的方式来提取变量
    // 这种方式可以正确处理 const 声明
    const fullCode = `
      (function() {
        const extracted = {};
        
        // 执行原始代码
        ${code}
        
        // 提取变量
        if (typeof config !== 'undefined') extracted.config = config;
        if (typeof handler !== 'undefined') extracted.handler = handler;
        if (typeof before !== 'undefined') extracted.before = before;
        if (typeof after !== 'undefined') extracted.after = after;
        if (typeof onRequest !== 'undefined') extracted.onRequest = onRequest;
        if (typeof onResponse !== 'undefined') extracted.onResponse = onResponse;
        if (typeof onError !== 'undefined') extracted.onError = onError;
        if (typeof onFinish !== 'undefined') extracted.onFinish = onFinish;
        
        return extracted;
      })()`;
    
    // 创建沙箱环境
    const sandbox = {
      console,
      require,
      process,
      __dirname: path.dirname(filePath),
      __filename: filePath,
      Buffer,
      setTimeout,
      setInterval,
      clearTimeout,
      clearInterval
    };
    
    // 使用 vm.Script 和 runInNewContext 执行代码
    const script = new vm.Script(fullCode);
    const middleware = script.runInNewContext(sandbox);
    
    if (!middleware.config) {
      throw new Error('中间件文件缺少 config 配置');
    }
    
    // 自动包装为 async 函数
    const asyncResult = { config: middleware.config };
    
    ['handler', 'before', 'after', 'onRequest', 'onResponse', 'onError', 'onFinish'].forEach(key => {
      if (typeof middleware[key] === 'function') {
        // 对于handler函数，如果它接受两个参数（ctx和next），自动注入next调用
        if (key === 'handler') {
          const originalHandler = middleware[key];
          asyncResult[key] = async function(ctx, next) {
            // 检查函数参数数量
            if (originalHandler.length === 2) {
              // 如果handler期望next参数，自动调用
              return await originalHandler(ctx, next);
            } else {
              // 否则直接执行handler，框架会自动处理next
              const result = await originalHandler(ctx);
              // 如果有next参数，调用它
              if (next) {
                await next();
              }
              return result;
            }
          };
        } else {
          // 其他钩子函数直接包装
          asyncResult[key] = async function(...args) {
            return await middleware[key](...args);
          };
        }
      }
    });
    
    return asyncResult;
  } catch (error) {
    console.error(`加载中间件文件 ${filePath} 失败:`, error.message);
    throw error;
  }
}

function loadMiddlewares(routerDir) {
  const middlewares = {
    private: [],
    public: [],
    protected: [],
    global: []
  };

  const middlewareDir = path.join(routerDir, 'middleware');
  
  if (!fs.existsSync(middlewareDir)) {
    console.warn('⚠ middleware 目录不存在');
    return middlewares;
  }

  console.log('\n========== 加载中间件 ==========\n');

  const files = fs.readdirSync(middlewareDir);

  files.forEach(file => {
    if (!file.endsWith('.js') || file.endsWith('.test.js')) return;

    const filePath = path.join(middlewareDir, file);
    
    try {
      const middlewareModule = loadMiddlewareFile(filePath);
      const config = middlewareModule.config;
      
      if (config.enabled === false) {
        console.log(`⊘ ${file} [已禁用]`);
        return;
      }

      const type = detectMiddlewareType(middlewareModule);
      
      const middlewareInfo = {
        name: file.replace('.js', ''),
        type,
        module: middlewareModule,
        config,
        order: config.order || 0,
        scope: config.scope || 'global',
        exclude: config.exclude || []
      };

      const levels = config.level || ['global'];
      levels.forEach(level => {
        if (middlewares[level]) {
          middlewares[level].push(middlewareInfo);
          console.log(`✓ ${file} → [${level}] (order: ${middlewareInfo.order}, type: ${type})`);
        }
      });

    } catch (error) {
      console.error(`✗ 加载中间件失败 ${file}:`, error.message);
    }
  });

  // 排序
  Object.keys(middlewares).forEach(key => {
    middlewares[key].sort((a, b) => {
      const orderA = a.order;
      const orderB = b.order;
      
      if (orderA >= 0 && orderB >= 0) return orderA - orderB;
      if (orderA < 0 && orderB < 0) return Math.abs(orderB) - Math.abs(orderA);
      return orderA >= 0 ? -1 : 1;
    });
  });

  console.log('\n========== 中间件加载完成 ==========\n');

  return middlewares;
}

function shouldExclude(url, excludePatterns) {
  return excludePatterns.some(pattern => {
    if (typeof pattern === 'string') {
      return url === pattern || url.startsWith(pattern);
    }
    if (pattern instanceof RegExp) {
      return pattern.test(url);
    }
    return false;
  });
}

function composeMiddlewares(middlewareList) {
  return async (ctx, next) => {
    const activeMiddlewares = middlewareList.filter(mw => 
      !shouldExclude(ctx.url, mw.exclude)
    );

    const onRequestHooks = [];
    const beforeHooks = [];
    const afterHooks = [];
    const onResponseHooks = [];
    const onErrorHooks = [];
    const onFinishHooks = [];

    for (const mw of activeMiddlewares) {
      switch (mw.type) {
        case 'simple':
          beforeHooks.push(mw.module.handler);
          break;
          
        case 'onion':
          if (mw.module.before) beforeHooks.push(mw.module.before);
          if (mw.module.after) afterHooks.unshift(mw.module.after);
          break;
          
        case 'lifecycle':
          if (mw.module.onRequest) onRequestHooks.push(mw.module.onRequest);
          if (mw.module.before) beforeHooks.push(mw.module.before);
          if (mw.module.after) afterHooks.unshift(mw.module.after);
          if (mw.module.onResponse) onResponseHooks.unshift(mw.module.onResponse);
          if (mw.module.onError) onErrorHooks.push(mw.module.onError);
          if (mw.module.onFinish) onFinishHooks.push(mw.module.onFinish);
          break;
      }
    }

    try {
      // 执行 onRequest 钩子（最先执行）
      for (const hook of onRequestHooks) {
        await hook(ctx);
      }

      // 执行 before 中间件（请求前处理）
      for (const hook of beforeHooks) {
        await hook(ctx); // 不需要 next 参数，按顺序执行
      }

      // 执行业务路由处理函数
      await next();

      // 执行 after 中间件（响应后处理）
      for (const hook of afterHooks) {
        await hook(ctx); // 不需要 next 参数，按顺序执行
      }

      // 执行 onResponse 钩子（响应前）
      for (const hook of onResponseHooks) {
        await hook(ctx);
      }

      // 注册 onFinish 钩子（异步，响应后执行）
      if (onFinishHooks.length > 0) {
        ctx.res.on('finish', async () => {
          for (const hook of onFinishHooks) {
            try {
              await hook(ctx);
            } catch (error) {
              console.error('onFinish 钩子执行失败:', error);
            }
          }
        });
      }

    } catch (error) {
      // 执行 onError 钩子
      for (const hook of onErrorHooks) {
        try {
          await hook(ctx, error);
        } catch (err) {
          console.error('onError 钩子执行失败:', err);
        }
      }
      throw error;
    }
  };
}

/**
 * ============================================
 * 路由扫描器
 * ============================================
 */

function parsePortFromFolderName(folderName) {
  const match = folderName.match(/^(.+):(\d+)$/);
  
  if (match) {
    return {
      name: match[1],
      port: parseInt(match[2], 10)
    };
  }
  
  return {
    name: folderName,
    port: null
  };
}

/**
 * 加载并标准化路由模块
 */
function loadRouteFile(filePath, fileName) {
  const code = fs.readFileSync(filePath, 'utf-8');
  
  // 使用函数包装的方式来提取变量
  // 这种方式可以正确处理 const 声明
  const safeFileName = fileName.replace(/-/g, '_');
  const fullCode = `
    (function() {
      const extracted = {};
      
      // 执行原始代码
      ${code}
      
      // 提取变量
      if (typeof config !== 'undefined') extracted.config = config;
      
      // 处理函数名，支持文件名包含连字符的情况
      let routeHandler;
      try {
        // 尝试直接获取（适用于无连字符的文件名）
        routeHandler = ${safeFileName};
      } catch (e) {
        // 尝试通过 this 获取（适用于有连字符的文件名）
        routeHandler = this[${JSON.stringify(fileName)}];
      }
      
      if (typeof routeHandler === 'function') extracted.handler = routeHandler;
      
      return extracted;
    })()`;
  
  // 创建沙箱环境
  const sandbox = {
    console,
    require,
    process,
    __dirname: path.dirname(filePath),
    __filename: filePath,
    Buffer,
    setTimeout,
    setInterval,
    clearTimeout,
    clearInterval
  };
  
  // 使用 vm.Script 和 runInNewContext 执行代码
  const script = new vm.Script(fullCode);
  const extracted = script.runInNewContext(sandbox);
  
  // 从提取的对象中获取变量
  const config = extracted.config;
  if (!config) {
    throw new Error('路由文件缺少 config 配置');
  }
  
  if (!config.method) {
    throw new Error('路由文件的 config 中缺少 method 字段');
  }
  
  const routeHandler = extracted.handler;
  if (typeof routeHandler !== 'function') {
    throw new Error(`路由文件中未找到同名方法: ${fileName}`);
  }
  
  // 自动包装为 async 函数
  const handler = async function(ctx) {
    // 注入静态资源管理方法
    const { getStaticResourceManager } = require('./utils/static');
    const staticManager = getStaticResourceManager({
      staticDir: path.join(process.cwd(), 'static')
    });
    
    // 发送静态资源响应
    ctx.sendFile = async (level, filePath) => {
      await staticManager.sendFile(ctx, level, filePath);
    };
    
    // 获取静态资源内容（用于二次加工）
    ctx.getFile = async (level, filePath, options) => {
      return await staticManager.getFile(level, filePath, options);
    };
    
    // 保存文件到静态资源目录
    ctx.saveFile = async (level, filePath, content, options) => {
      return await staticManager.saveFile(level, filePath, content, options);
    };
    
    // 检查文件是否存在
    ctx.fileExists = async (level, filePath) => {
      return await staticManager.exists(level, filePath);
    };
    
    // 获取文件信息
    ctx.getFileInfo = async (level, filePath) => {
      return await staticManager.stat(level, filePath);
    };
    
    const res = await routeHandler(ctx);
    
    // 如果返回了值且未设置 body，自动设置
    if (res !== undefined && ctx.body === undefined) {
      ctx.body = res;
    }
  };
  
  return {
    config,
    handler
  };
}

/**
 * 扫描目录，加载路由文件
 */
function scanDirectoryRecursive(dirPath, currentPath = '') {
  const routes = [];

  if (!fs.existsSync(dirPath)) {
    return routes;
  }

  const items = fs.readdirSync(dirPath);

  items.forEach(item => {
    const itemPath = path.join(dirPath, item);
    const stat = fs.statSync(itemPath);

    if (stat.isFile() && item.endsWith('.js') && !item.endsWith('.test.js')) {
      try {
        const fileName = item.replace('.js', '');
        const { config, handler } = loadRouteFile(itemPath, fileName);
        
        // 生成路由路径，对于root目录下的文件，路径不包含root
        let fullPath;
        if (fileName === 'id') {
          // 特殊处理：如果文件名为id，生成动态路由 /:id
          fullPath = currentPath ? `${currentPath}/:id` : `/:id`;
        } else {
          fullPath = currentPath ? `${currentPath}/${fileName}` : `/${fileName}`;
        }

        routes.push({
          path: fullPath,
          method: config.method.toLowerCase(),
          handler,
          config,
          file: itemPath,
          fileName
        });

        console.log(`   ✓ ${config.method.toUpperCase().padEnd(7)} ${fullPath}`);
        
      } catch (error) {
        console.error(`   ✗ 加载失败 ${itemPath}:`);
        console.error(`      ${error.message}`);
      }
    } else if (stat.isDirectory()) {
      // 如果目录名为root，则currentPath保持不变，否则添加目录名
      let newPath;
      if (item === 'root') {
        newPath = currentPath; // 对于root目录，路径不包含root
      } else {
        newPath = currentPath ? `${currentPath}/${item}` : `/${item}`;
      }
      const subRoutes = scanDirectoryRecursive(itemPath, newPath);
      routes.push(...subRoutes);
    }
  });

  return routes;
}

/**
 * ============================================
 * 虚拟主机支持
 * ============================================
 */

function createVhost(hostname, app) {
  return async (ctx, next) => {
    const host = ctx.host.split(':')[0];
    
    if (host === hostname || host.endsWith(`.${hostname}`)) {
      await app.callback()(ctx.req, ctx.res);
    } else {
      await next();
    }
  };
}

function createSubdomainApp(routes, type, middlewares) {
  const app = new Koa();

  // 添加调试中间件
  app.use(async (ctx, next) => {
    console.log(`收到请求: ${ctx.method} ${ctx.path} (${type} 子域名应用)`);
    await next();
  });

  const globalMiddlewares = middlewares.global || [];
  app.use(composeMiddlewares(globalMiddlewares));

  const typeMiddlewares = middlewares[type] || [];
  app.use(composeMiddlewares(typeMiddlewares));

  const router = new Router();

  routes.forEach(({ path: routePath, method, handler, config, fileName }) => {
    const wrappedHandler = async (ctx) => {
      console.log(`执行路由: ${method.toUpperCase()} ${routePath} (${fileName})`);
      ctx.state.routeConfig = config;
      await handler(ctx);
    };

    switch (method) {
      case 'get':
        router.get(routePath, wrappedHandler);
        break;
      case 'post':
        router.post(routePath, wrappedHandler);
        break;
      case 'put':
        router.put(routePath, wrappedHandler);
        break;
      case 'patch':
        router.patch(routePath, wrappedHandler);
        break;
      case 'delete':
        router.del(routePath, wrappedHandler);
        break;
      case 'all':
        router.all(routePath, wrappedHandler);
        break;
      default:
        console.warn(`⚠ 未知的 HTTP 方法: ${method} (${fileName})`);
    }
  });

  app.use(router.routes());
  app.use(router.allowedMethods());

  app.use(async (ctx) => {
    if (!ctx.body && ctx.status === 404) {
      ctx.status = 404;
      ctx.body = {
        success: false,
        message: '请求的路由不存在',
        path: ctx.path,
        type
      };
    }
  });

  return app;
}

/**
 * ============================================
 * 调试中间件
 * ============================================
 */

async function debugMiddleware(ctx, next) {
  console.log(`中间件执行开始: ${ctx.method} ${ctx.path}`);
  await next();
  console.log(`中间件执行结束: ${ctx.method} ${ctx.path} ${ctx.status}`);
}

/**
 * ============================================
 * 主路由初始化函数
 * ============================================
 */

async function initializeRoutes(mainApp, options = {}) {
  const {
    rootDomain = 'localhost',
    defaultPort = 3000,
    routerDir = path.join(process.cwd(), 'router')
  } = options;

  // 使用传入的routerDir或默认值

  console.log('\n========== 开始加载路由系统 ==========');
  console.log(`根域名: ${rootDomain}`);
  console.log(`默认端口: ${defaultPort}\n`);

  const middlewares = loadMiddlewares(routerDir);
  mainApp.use(debugMiddleware);
  mainApp.use(composeMiddlewares(middlewares.global));

  const types = ['private', 'public', 'protected'];
  const subdomainConfigs = [];
  const portApps = new Map();

  portApps.set(defaultPort, {
    app: mainApp,
    domains: []
  });

  types.forEach(type => {
    const typeDir = path.join(routerDir, type);

    if (!fs.existsSync(typeDir)) {
      console.log(`⚠ 目录不存在: ${type}/\n`);
      return;
    }

    console.log(`${type.toUpperCase()} 路由配置:`);

    const items = fs.readdirSync(typeDir);

    items.forEach(item => {
      const itemPath = path.join(typeDir, item);
      const stat = fs.statSync(itemPath);

      if (!stat.isDirectory()) return;

      const { name: subdomainName, port: customPort } = parsePortFromFolderName(item);
      const targetPort = customPort || defaultPort;

      if (subdomainName === 'root') {
        console.log(`\n   根域名路由 (${rootDomain}:${targetPort}):`);
        const rootRoutes = scanDirectoryRecursive(itemPath, '');

        if (rootRoutes.length === 0) {
          console.log(`   (无路由)`);
          return;
        }

        subdomainConfigs.push({
          type,
          subdomain: null,
          port: targetPort,
          routes: rootRoutes,
          isRoot: true
        });

        return;
      }

      console.log(`\n   子域名: ${subdomainName}.${rootDomain}:${targetPort}`);

      const subdomainRoutes = scanDirectoryRecursive(itemPath, '');

      if (subdomainRoutes.length === 0) {
        console.log(`      (无路由)`);
        return;
      }

      subdomainConfigs.push({
        type,
        subdomain: subdomainName,
        port: targetPort,
        routes: subdomainRoutes,
        isRoot: false
      });
    });

    console.log('');
  });

  console.log('========== 配置虚拟主机 ==========\n');

  const portGroups = new Map();
  
  subdomainConfigs.forEach(config => {
    if (!portGroups.has(config.port)) {
      portGroups.set(config.port, []);
    }
    portGroups.get(config.port).push(config);
  });

  for (const [port, configs] of portGroups.entries()) {
    let app;
    
    if (port === defaultPort) {
      app = mainApp;
    } else {
      app = new Koa();
      app.use(composeMiddlewares(middlewares.global));
      
      portApps.set(port, {
        app,
        domains: []
      });
    }

    configs.forEach(config => {
      const { type, subdomain, routes, isRoot } = config;
      const typeLabel = type === 'private' ? '[PRIVATE]' : 
                       type === 'protected' ? '[PROTECTED]' : '[PUBLIC]';

      if (isRoot) {
        // 添加调试中间件
        app.use(async (ctx, next) => {
          console.log(`收到根域名请求: ${ctx.method} ${ctx.path} (${type} 路由)`);
          await next();
        });

        app.use(composeMiddlewares(middlewares[type] || []));

        const router = new Router();

        routes.forEach(({ path: routePath, method, handler, config, fileName }) => {
          const wrappedHandler = async (ctx) => {
            console.log(`执行根域名路由: ${method.toUpperCase()} ${routePath} (${fileName})`);
            ctx.state.routeConfig = config;
            await handler(ctx);
          };

          switch (method) {
            case 'get':
              router.get(routePath, wrappedHandler);
              console.log(`注册根域名路由: GET ${routePath}`);
              break;
            case 'post':
              router.post(routePath, wrappedHandler);
              console.log(`注册根域名路由: POST ${routePath}`);
              break;
            case 'put':
              router.put(routePath, wrappedHandler);
              console.log(`注册根域名路由: PUT ${routePath}`);
              break;
            case 'patch':
              router.patch(routePath, wrappedHandler);
              console.log(`注册根域名路由: PATCH ${routePath}`);
              break;
            case 'delete':
              router.del(routePath, wrappedHandler);
              console.log(`注册根域名路由: DELETE ${routePath}`);
              break;
            case 'all':
              router.all(routePath, wrappedHandler);
              console.log(`注册根域名路由: ALL ${routePath}`);
              break;
          }
        });

        app.use(router.routes());
        app.use(router.allowedMethods());

        console.log(`${typeLabel} 根域名 (${rootDomain}:${port})`);
        routes.forEach(({ method, path }) => {
          console.log(`   └─ ${method.toUpperCase().padEnd(7)} ${path}`);
        });
        console.log('');
      } else {
        const subdomainApp = createSubdomainApp(routes, type, middlewares);
        const domainPattern = `${subdomain}.${rootDomain}`;
        
        app.use(createVhost(domainPattern, subdomainApp));

        console.log(`${typeLabel} ${domainPattern}:${port}`);
        routes.forEach(({ method, path }) => {
          console.log(`   └─ ${method.toUpperCase().padEnd(7)} ${path}`);
        });
        console.log('');

        portApps.get(port).domains.push(domainPattern);
      }
    });
  }

  const servers = [];
  
  for (const [port, { app, domains }] of portApps.entries()) {
    if (port !== defaultPort) {
      try {
        const server = await startServerOnPort(
          app, 
          port, 
          domains.join(', ') || 'root'
        );
        servers.push({ port, server });
      } catch (error) {
        console.error(`✗ 无法启动端口 ${port} 的服务器:`, error.message);
      }
    }
  }

  console.log('\n========== 路由系统加载完成 ==========\n');

  return {
    servers,
    portApps
  };
}

function startServerOnPort(app, port, name) {
  return new Promise((resolve, reject) => {
    try {
      const server = app.listen(port, () => {
        console.log(`${name} 服务运行在端口 ${port}`);
        resolve(server);
      });

      server.on('error', (error) => {
        if (error.code === 'EADDRINUSE') {
          console.error(`✗ 端口 ${port} 已被占用 (${name})`);
        } else {
          console.error(`✗ ${name} 启动失败:`, error.message);
        }
        reject(error);
      });
    } catch (error) {
      reject(error);
    }
  });
}

module.exports = {
  initializeRoutes
};
