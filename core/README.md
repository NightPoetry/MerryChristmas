# MerryChristmas 服务器核心组件

## 项目介绍

MerryChristmas 服务器是一个基于 Koa.js 的轻量级、可扩展的 Node.js 服务器框架，具有以下特点：

- 可实例化的组件设计
- 支持自定义配置
- 自动加载中间件和路由
- 完善的错误处理机制
- 支持优雅关闭
- 可作为 npm 包使用

## 安装

### 作为 npm 包使用

```bash
# 安装包
npm install merrychristmas-server
```

### 本地开发

```bash
# 克隆 core 仓库
git clone <core-repository-url> merrychristmas-core
cd merrychristmas-core

# 安装依赖
npm install
```

## 快速开始

### 基本用法

```javascript
const MerryChristmasServer = require('merrychristmas-server');

// 实例化服务器
const server = new MerryChristmasServer({
  port: 3000,
  host: '0.0.0.0',
  rootDomain: 'localhost'
});

// 启动服务器
server.start()
  .then(servers => {
    console.log('服务器启动成功');
  })
  .catch(error => {
    console.error('服务器启动失败:', error.message);
  });
```

### Express 风格的启动方式

```javascript
const MerryChristmasServer = require('merrychristmas-server');

const server = new MerryChristmasServer({
  port: 3000
});

// 启动服务器
(async () => {
  try {
    await server.start();
    console.log('服务器启动成功');
  } catch (error) {
    console.error('服务器启动失败:', error.message);
    process.exit(1);
  }
})();
```

## 配置选项

### 构造函数参数

```javascript
const server = new MerryChristmasServer({
  // 服务器基本配置
  port: 3000,                  // 服务器端口，默认 3000
  host: '0.0.0.0',             // 服务器主机，默认 0.0.0.0
  rootDomain: 'localhost',      // 根域名，默认 localhost
  env: 'development',           // 环境，默认 development
  staticDir: './static',        // 静态文件目录，默认 static
  routerDir: './router',        // 路由目录，默认项目根目录下的 router
  storageDir: './storage',      // 存储目录，默认项目根目录下的 storage
  
  // 中间件配置
  middleware: {
    // 自定义中间件配置
  },
  
  // bodyParser 配置
  bodyParser: {
    enableTypes: ['json', 'form', 'text'],
    jsonLimit: '10mb',
    formLimit: '10mb',
    textLimit: '10mb'
  }
});
```

### 环境变量支持

组件支持通过环境变量配置：

- `PORT` - 服务器端口
- `HOST` - 服务器主机
- `ROOT_DOMAIN` - 根域名
- `NODE_ENV` - 环境

## 中间件系统

### 中间件命名空间

服务器组件提供了 `utils.middleware.xxxx` 命名空间，用于直接调用内置中间件：

```javascript
const { middleware } = require('merrychristmas-server');

// 使用内置中间件
const corsMiddleware = middleware.cors;
const loggerMiddleware = middleware.logger;
const errorHandlerMiddleware = middleware.errorHandler;
```

### 中间件自动加载

中间件会在服务器初始化时自动加载，加载规则：

1. 从 `core/middleware` 目录加载所有 `.js` 文件
2. 根据中间件的 `config.level` 决定其作用范围
3. 根据中间件的 `config.order` 决定其执行顺序
4. 自动处理中间件的启用状态（`config.enabled`）

### 手动添加中间件

服务器实例提供了以下方法用于手动添加和管理中间件：

#### use()

```javascript
use(middleware: Function): MerryChristmasServer
```

添加中间件到中间件堆栈的末尾。

```javascript
const server = new MerryChristmasServer();

// 添加自定义中间件
server.use(async (ctx, next) => {
  console.log('自定义中间件执行');
  await next();
});
```

#### unshift()

```javascript
unshift(middleware: Function): MerryChristmasServer
```

添加中间件到中间件堆栈的最前面。

```javascript
server.unshift(async (ctx, next) => {
  console.log('在所有中间件之前执行');
  await next();
});
```

#### getMiddlewares()

```javascript
getMiddlewares(): Array
```

获取所有自定义添加的中间件。

#### clearMiddlewares()

```javascript
clearMiddlewares(): MerryChristmasServer
```

清除所有自定义添加的中间件。

## API 参考

### 构造函数

```javascript
new MerryChristmasServer(config)
```

创建一个新的服务器实例。

### 方法

#### start()

```javascript
async start(): Promise<Array>
```

启动服务器，返回服务器实例数组。

- **返回值**：Promise，解析为服务器实例数组
- **抛出错误**：如果服务器初始化失败

#### stop()

```javascript
async stop(): Promise<void>
```

停止服务器。

#### getApp()

```javascript
getApp(): Koa
```

获取 Koa 应用实例。

#### getConfig()

```javascript
getConfig(): Object
```

获取服务器配置。

#### getStatus()

```javascript
getStatus(): boolean
```

获取服务器运行状态，返回 `true` 表示正在运行，`false` 表示已停止。

#### getServers()

```javascript
getServers(): Array
```

获取服务器实例数组。

#### use()

```javascript
use(middleware: Function): MerryChristmasServer
```

添加中间件到中间件堆栈的末尾，支持链式调用。

#### unshift()

```javascript
unshift(middleware: Function): MerryChristmasServer
```

添加中间件到中间件堆栈的最前面，支持链式调用。

#### getMiddlewares()

```javascript
getMiddlewares(): Array
```

获取所有自定义添加的中间件。

#### clearMiddlewares()

```javascript
clearMiddlewares(): MerryChristmasServer
```

清除所有自定义添加的中间件，支持链式调用。

## 路由系统

### 路由文件结构

```
router/
├── private/          # 私有路由（仅本地访问）
├── public/           # 公共路由（无需认证）
└── protected/        # 受保护路由（需要 JWT 认证）
    ├── root/         # 根域名路由
    │   └── index.js  # 路由文件，路径为 /index
    └── api/          # api 子域名路由
        └── users.js  # 路由文件，路径为 /users
```

### 路由文件示例

```javascript
// router/public/root/index.js

const config = {
  method: 'GET',
  description: '首页路由'
};

function index(ctx) {
  return {
    success: true,
    message: 'Merry Christmas!',
    data: {
      title: 'Welcome to Merry Christmas Server',
      version: '1.0.0'
    }
  };
}
```

## 中间件系统

### 中间件文件示例

```javascript
// router/middleware/logger.js

const config = {
  level: ['global'],
  order: 1,
  enabled: true
};

function handler(ctx) {
  console.log(`${new Date().toISOString()} - ${ctx.method} ${ctx.url}`);
}
```

### 中间件类型

1. **Simple 模式**：仅包含 `handler` 函数
2. **Onion 模式**：包含 `before` 和 `after` 函数
3. **Lifecycle 模式**：包含 `onRequest`、`before`、`after`、`onResponse`、`onError`、`onFinish` 钩子

## 错误处理

### 错误类型

- **400 Bad Request** - 请求参数错误
- **401 Unauthorized** - 未授权
- **403 Forbidden** - 禁止访问
- **404 Not Found** - 资源不存在
- **500 Internal Server Error** - 服务器内部错误

### 自定义错误

```javascript
ctx.throw(400, '请求参数错误');
```

## 示例应用

### 完整示例

```javascript
const MerryChristmasServer = require('merrychristmas-server');

// 配置
const config = {
  port: 3000,
  host: '0.0.0.0',
  rootDomain: 'localhost',
  env: 'development',
  staticDir: './public'
};

// 实例化服务器
const server = new MerryChristmasServer(config);

// 启动服务器
async function startServer() {
  try {
    const servers = await server.start();
    console.log('服务器启动成功');
    console.log(`访问地址: http://localhost:${config.port}`);
    
    // 10秒后自动停止服务器
    setTimeout(async () => {
      console.log('\n正在停止服务器...');
      await server.stop();
      console.log('服务器已停止');
    }, 10000);
    
  } catch (error) {
    console.error('服务器启动失败:', error.message);
    process.exit(1);
  }
}

// 执行启动
startServer();
```

### 多服务器实例

```javascript
const MerryChristmasServer = require('merrychristmas-server');

// 实例化多个服务器
const server1 = new MerryChristmasServer({ port: 3000 });
const server2 = new MerryChristmasServer({ port: 3001 });

// 启动所有服务器
Promise.all([server1.start(), server2.start()])
  .then(() => {
    console.log('所有服务器启动成功');
  })
  .catch(error => {
    console.error('服务器启动失败:', error.message);
  });
```

### 使用中间件命名空间

```javascript
const { MerryChristmasServer, middleware } = require('merrychristmas-server');

// 实例化服务器
const server = new MerryChristmasServer();

// 获取内置中间件配置
console.log('CORS 中间件配置:', middleware.cors.config);
console.log('Logger 中间件配置:', middleware.logger.config);

// 启动服务器
server.start();
```

### 手动添加中间件

```javascript
const MerryChristmasServer = require('merrychristmas-server');

// 实例化服务器
const server = new MerryChristmasServer();

// 添加自定义中间件
server.use(async (ctx, next) => {
  const startTime = Date.now();
  await next();
  const ms = Date.now() - startTime;
  console.log(`${ctx.method} ${ctx.url} - ${ms}ms`);
});

// 链式调用
server.use(async (ctx, next) => {
  console.log('第二个中间件执行');
  await next();
}).use(async (ctx, next) => {
  console.log('第三个中间件执行');
  await next();
});

// 启动服务器
server.start();
```

## 部署

### 开发环境

```bash
npm run dev
```

### 生产环境

```bash
# 构建
npm run build

# 启动
NODE_ENV=production npm start
```

### Docker 部署

```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install --production

COPY . .

EXPOSE 3000

CMD ["node", "server.js"]
```

## 常见问题

### Q: 如何修改端口？

A: 可以通过配置参数或环境变量修改端口：

```javascript
// 通过配置参数
const server = new MerryChristmasServer({ port: 3001 });

// 通过环境变量
PORT=3001 node server.js
```

### Q: 如何添加自定义中间件？

A: 有两种方式添加自定义中间件：

1. **自动加载**：在 `core/middleware/` 目录下创建中间件文件，组件会自动加载
2. **手动添加**：使用服务器实例的 `use()` 或 `unshift()` 方法手动添加中间件

```javascript
// 手动添加中间件示例
const server = new MerryChristmasServer();

server.use(async (ctx, next) => {
  console.log('自定义中间件执行');
  await next();
});
```

### Q: 如何自定义路由？

A: 在 `router/` 目录下创建对应的路由文件，组件会自动扫描并加载。

### Q: 如何处理静态文件？

A: 组件默认支持静态文件服务，静态文件目录默认为 `static/`，支持不同安全级别的静态资源：

```javascript
const server = new MerryChristmasServer({ staticDir: './static' });
```

#### 静态资源目录结构

```
static/
├── private/          # 私有静态资源（仅内部路由访问）
├── protected/        # 受保护静态资源（仅内部路由访问）
└── public/           # 公共静态资源（直接访问）
```

#### 访问方式

- **公共静态资源**：直接访问，如 `http://localhost:3000/image.jpg`
- **受保护静态资源**：仅通过内部路由访问，禁止直接外部访问
- **私有静态资源**：仅通过内部路由访问，禁止直接外部访问

#### 内部路由访问静态资源

路由文件中可以通过以下方法访问静态资源：

##### 1. 发送静态资源响应

```javascript
const config = {
  method: 'GET',
  description: '访问受保护静态资源',
  requireRoles: ['user'] // 需要JWT认证
};

async function protectedResource(ctx) {
  // 通过内部路由访问受保护静态资源
  await ctx.sendFile('protected', 'image.jpg');
}
```

##### 2. 获取静态资源内容（用于二次加工）

```javascript
const config = {
  method: 'GET',
  description: '获取受保护资源并二次加工',
  requireRoles: ['user'] // 需要JWT认证
};

async function processProtectedResource(ctx) {
  // 获取受保护静态资源内容
  const content = await ctx.getFile('protected', 'data.txt', { encoding: 'utf8' });
  
  // 二次加工
  const processedContent = content.toUpperCase();
  
  // 返回加工后的内容
  ctx.body = {
    originalContent: content,
    processedContent: processedContent
  };
}
```

##### 3. 检查文件是否存在

```javascript
const config = {
  method: 'GET',
  description: '检查文件是否存在',
  requireRoles: ['user'] // 需要JWT认证
};

async function checkFile(ctx) {
  // 检查文件是否存在
  const exists = await ctx.fileExists('protected', 'image.jpg');
  
  ctx.body = {
    exists: exists
  };
}
```

##### 4. 获取文件信息

```javascript
const config = {
  method: 'GET',
  description: '获取文件信息',
  requireRoles: ['user'] // 需要JWT认证
};

async function getFileInfo(ctx) {
  // 获取文件信息
  const fileInfo = await ctx.getFileInfo('protected', 'image.jpg');
  
  ctx.body = {
    size: fileInfo.size,
    createdAt: fileInfo.birthtime,
    modifiedAt: fileInfo.mtime
  };
}
```

##### 5. 保存文件（处理上传）

```javascript
const config = {
  method: 'POST',
  description: '处理文件上传',
  requireRoles: ['user'] // 需要JWT认证
};

async function uploadFile(ctx) {
  // 从请求体中获取文件内容
  const { fileName, content } = ctx.request.body;
  
  if (!fileName || !content) {
    ctx.throw(400, '缺少文件名或内容');
  }
  
  // 保存文件到受保护目录
  const savedPath = await ctx.saveFile('protected', fileName, content, { encoding: 'utf8' });
  
  ctx.body = {
    success: true,
    message: '文件保存成功',
    data: {
      path: savedPath,
      fileName: fileName
    }
  };
}

// 处理二进制文件上传（如图片、视频等）
async function uploadBinaryFile(ctx) {
  // 获取二进制文件内容（假设使用了文件上传中间件，如 koa-multer）
  const file = ctx.request.file;
  
  if (!file) {
    ctx.throw(400, '未找到上传的文件');
  }
  
  // 保存二进制文件
  const savedPath = await ctx.saveFile('protected', file.originalname, file.buffer);
  
  ctx.body = {
    success: true,
    message: '文件上传成功',
    data: {
      path: savedPath,
      fileName: file.originalname,
      size: file.size
    }
  };
}

#### 静态资源访问控制规则

1. **公共静态资源**
   - 可以通过公开URL直接访问
   - 无需认证
   - 适合网站图片、样式表等公开资源

2. **受保护静态资源**
   - 禁止直接通过公开URL访问
   - 必须通过受保护路由访问
   - 需要JWT认证和权限检查
   - 适合用户头像、私人文件等受保护资源

3. **私有静态资源**
   - 禁止直接通过公开URL访问
   - 必须通过私有路由访问
   - 仅允许本地IP访问
   - 适合服务器内部资源、敏感配置文件等私有资源

## 贡献

欢迎提交 Issue 和 Pull Request！

## 许可证

MIT

## 更新日志

### 1.0.0 (2024-12-23)

- 重构为可实例化的组件
- 支持作为 npm 包使用
- 完善的错误处理机制
- 详细的 API 文档

## CLI 工具

### 安装 CLI

```bash
npm install -g merrychristmas-server
```

### 使用 CLI 创建默认文件夹结构

```bash
# 在当前目录创建默认文件夹结构
merrychristmas init

# 在指定目录创建默认文件夹结构
merrychristmas init <target-directory>
```

### 默认文件夹结构

执行 `merrychristmas init` 命令后，将创建以下默认文件夹结构：

```
.
├── router/                    # 路由目录
│   ├── private/               # 私有路由（仅本地访问）
│   ├── public/                # 公共路由（无需认证）
│   └── protected/             # 受保护路由（需要 JWT 认证）
│       ├── root/              # 根域名路由
│       └── api/               # api 子域名路由
├── storage/                   # 存储目录
│   ├── private/               # 私有存储
│   ├── protected/             # 受保护存储
│   └── public/                # 公共存储
├── static/                    # 静态文件目录
│   ├── private/               # 私有静态资源
│   ├── protected/             # 受保护静态资源
│   └── public/                # 公共静态资源
└── middleware/                # 自定义中间件目录
```

### CLI 命令说明

#### `merrychristmas init [directory]`

创建默认的项目文件夹结构。

- **directory**: 可选，指定要创建结构的目录，默认为当前目录

## 项目结构说明

### 核心文件

- `server.js`: 服务器主类，负责服务器的初始化、启动和关闭
- `router.js`: 路由系统，负责路由的自动加载和处理
- `middleware/`: 内置中间件目录，包含各种功能中间件

### 使用流程

1. **安装包**: `npm install merrychristmas-server`
2. **初始化项目结构**: `merrychristmas init`
3. **编写路由文件**（在 `router/` 目录下）
4. **编写自定义中间件**（可选，在 `middleware/` 目录下）
5. **创建主入口文件**，实例化并启动服务器

## 联系方式

- GitHub: [MerryChristmasServer](https://github.com/yourusername/merrychristmas-server)
- Issues: [Issues](https://github.com/yourusername/merrychristmas-server/issues)

---

Merry Christmas and Happy New Year!

