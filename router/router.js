
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
  if (module.onRequest || module.onResponse || module.onFinish) {
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
  const code = fs.readFileSync(filePath, 'utf-8');
  
  // 创建沙箱环境
  const sandbox = {
    console,
    require,
    process,
    __dirname: path.dirname(filePath),
    __filename: filePath
  };
  
  // 执行代码
  vm.createContext(sandbox);
  vm.runInContext(code, sandbox);
  
  // 提取 config 和处理函数
  const config = sandbox.config;
  
  if (!config) {
    throw new Error('中间件文件缺少 config 配置');
  }
  
  // 收集处理函数（自动包装为 async）
  const result = { config };
  
  ['handler', 'before', 'after', 'onRequest', 'onResponse', 'onError', 'onFinish'].forEach(key => {
    if (typeof sandbox[key] === 'function') {
      // 自动包装为 async 函数
      result[key] = async function(...args) {
        return await sandbox[key](...args);
      };
    }
  });
  
  return result;
}

function loadMiddlewares() {
  const middlewares = {
    private: [],
    public: [],
    protected: [],
    global: []
  };

  const middlewareDir = path.join(__dirname, 'middleware');
  
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
      for (const hook of onRequestHooks) {
        await hook(ctx);
      }

      for (const hook of beforeHooks) {
        await hook(ctx);
      }

      await next();

      for (const hook of afterHooks) {
        await hook(ctx);
      }

      for (const hook of onResponseHooks) {
        await hook(ctx);
      }

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
  
  // 执行代码
  vm.createContext(sandbox);
  vm.runInContext(code, sandbox);
  
  // 验证并提取
  if (!sandbox.config) {
    throw new Error('路由文件缺少 config 配置');
  }
  
  if (!sandbox.config.method) {
    throw new Error('路由文件的 config 中缺少 method 字段');
  }
  
  if (typeof sandbox[fileName] !== 'function') {
    throw new Error(`路由文件中未找到同名方法: ${fileName}`);
  }
  
  // 自动包装为 async 函数
  const handler = async function(ctx) {
    const result = await sandbox[fileName](ctx);
    
    // 如果返回了值且未设置 body，自动设置
    if (result !== undefined && ctx.body === undefined) {
      ctx.body = result;
    }
  };
  
  return {
    config: sandbox.config,
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
        
        const fullPath = currentPath ? `${currentPath}/${fileName}` : `/${fileName}`;

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
      const newPath = currentPath ? `${currentPath}/${item}` : `/${item}`;
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

  const globalMiddlewares = middlewares.global || [];
  app.use(composeMiddlewares(globalMiddlewares));

  const typeMiddlewares = middlewares[type] || [];
  app.use(composeMiddlewares(typeMiddlewares));

  const router = new Router();

  routes.forEach(({ path: routePath, method, handler, config, fileName }) => {
    const wrappedHandler = async (ctx) => {
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
 * 主路由初始化函数
 * ============================================
 */

async function initializeRoutes(mainApp, options = {}) {
  const {
    rootDomain = 'localhost',
    defaultPort = 3000
  } = options;

  const routerDir = __dirname;

  console.log('\n========== 开始加载路由系统 ==========');
  console.log(`根域名: ${rootDomain}`);
  console.log(`默认端口: ${defaultPort}\n`);

  const middlewares = loadMiddlewares();
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

    console.log(`📁 ${type.toUpperCase()} 路由配置:`);

    const items = fs.readdirSync(typeDir);

    items.forEach(item => {
      const itemPath = path.join(typeDir, item);
      const stat = fs.statSync(itemPath);

      if (!stat.isDirectory()) return;

      const { name: subdomainName, port: customPort } = parsePortFromFolderName(item);
      const targetPort = customPort || defaultPort;

      if (subdomainName === 'root') {
        console.log(`\n   📌 根域名路由 (${rootDomain}:${targetPort}):`);
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

      console.log(`\n   🌐 子域名: ${subdomainName}.${rootDomain}:${targetPort}`);

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
      const typeLabel = type === 'private' ? '🔒' : 
                       type === 'protected' ? '🔐' : '🔓';

      if (isRoot) {
        app.use(composeMiddlewares(middlewares[type] || []));

        const router = new Router();

        routes.forEach(({ path: routePath, method, handler, config, fileName }) => {
          const wrappedHandler = async (ctx) => {
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
        console.log(`🚀 ${name} 服务运行在端口 ${port}`);
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
