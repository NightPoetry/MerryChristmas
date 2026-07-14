
# 🎄 MerryChristmas

极简路由框架 - 基于 Koa 的轻量级企业级应用框架

---

## 🚀 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 配置环境变量

```bash
# 复制环境变量模板
cp .env.example .env

# 编辑 .env 文件，设置你的配置
```

### 3. 启动服务

```bash
# 开发模式（热重载）
npm run dev

# 生产模式
npm start
```

### 4. 访问应用

- **根域名**: http://localhost:3000
- **API 域名**: http://api.localhost:3000
- **管理域名**: http://admin.localhost:3000

---

## 📁 项目结构

```
MerryChristmas/
├── core/                          # 核心模块
│   ├── middleware/               # 中间件目录
│   └── router.js                 # 路由加载器
├── docs/                          # 文档
├── router/                        # 项目路由
│   ├── private/                  # 私有路由（127.0.0.1）
│   ├── public/                   # 公开路由
│   └── protected/                # 受保护路由
├── .gitignore
├── nodemon.json                  # 开发环境配置
├── package.json
└── server.js                     # 项目入口
```

---

## 🎯 核心特性

### ✨ 路由系统

- **极简语法** - 无需 `exports`，直接使用 `const` 和 `function`
- **自动加载** - 自动扫描路由文件，无需手动注册
- **文件名即路由** - 文件名自动映射为 URL 路径
- **虚拟主机** - 支持子域名和自定义端口

### 🔧 中间件系统

- **灵活配置** - 支持多种中间件模式
- **自动排序** - 基于 `order` 字段自动排序
- **路径过滤** - 支持 `exclude` 排除特定路径

### 🛡️ 安全特性

- **认证机制** - 支持多种认证方式
- **权限控制** - 基于角色和权限的访问控制
- **防护机制** - 内置多种安全防护措施

### 📊 其他特性

- **统一处理** - 统一的错误处理和响应格式化
- **可扩展性** - 易于扩展和定制

---

## 📝 编写路由

### 基本示例

创建文件：`router/public/root/hello.js`

```javascript
const config = {
  method: 'GET'
};

function hello(ctx) {
  ctx.body = { message: 'Hello World' };
}
```

访问：`GET http://localhost:3000/hello`

### 完整示例

创建文件：`router/protected/api/users/profile.js`

```javascript
const config = {
  method: 'GET',
  requireRoles: ['user', 'admin'],
  sensitiveFields: {
    email: ['admin'],
    phone: ['admin']
  }
};

function profile(ctx) {
  // 获取当前用户信息
  const userId = ctx.user.id;
  
  // 实现业务逻辑
  const user = {
    id: userId,
    name: '示例用户',
    email: 'user@example.com',
    phone: '13800138000'
  };
  
  if (!user) {
    ctx.throw(404, '用户不存在');
  }
  
  return user;
}
```

访问：`GET http://api.localhost:3000/users/profile`

更多示例请查看：[路由编写规则手册](./docs/路由编写规则手册.md)

---

## 🔧 中间件系统

### 中间件命名空间

可以通过 `utils.middleware.xxxx` 命名空间直接调用内置中间件：

```javascript
const { middleware } = require('merrychristmas-server');

// 使用内置中间件配置
console.log('CORS 中间件:', middleware.cors.config);
console.log('Logger 中间件:', middleware.logger.config);
```

### 编写中间件

创建文件：`core/middleware/custom.js`

```javascript
const config = {
  level: ['global'],
  order: 5,
  enabled: true,
  description: '自定义中间件'
};

async function handler(ctx) {
  console.log(`${ctx.method} ${ctx.url} - 自定义中间件执行`);
}

// 导出中间件，符合 npm 包规范
module.exports = {
  config,
  handler
};
```

### 手动添加中间件

```javascript
const MerryChristmasServer = require('merrychristmas-server');
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
  console.log('第二个中间件');
  await next();
});

// 启动服务器
server.start();
```

更多示例请查看：[中间件编写规则手册](./docs/中间件编写规则手册.md)

---

## 🌐 域名和端口配置

### 根域名路由

```
router/public/root/login.js
→ http://localhost:3000/login
```

### 子域名路由

```
router/public/api/status.js
→ http://api.localhost:3000/status
```

### 自定义端口

```
router/public/admin:3001/dashboard.js
→ http://admin.localhost:3001/dashboard
```

---

## 📚 文档

- [路由编写规则手册](./docs/路由编写规则手册.md)
- [中间件编写规则手册](./docs/中间件编写规则手册.md)

---

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

---

## 📄 许可证

Apache License 2.0

---

## 💡 常见问题

### Q: 如何修改默认端口？

A: 在 `.env` 文件中设置 `PORT=你的端口`，或启动时：`PORT=3001 npm start`

### Q: 子域名在本地无法访问？

A: 在 `/etc/hosts`（Linux/Mac）或 `C:\Windows\System32\drivers\etc\hosts`（Windows）添加：

```
127.0.0.1 localhost
127.0.0.1 api.localhost
127.0.0.1 admin.localhost
```

### Q: 如何禁用某个中间件？

A: 在中间件文件的 config 中设置：`enabled: false`

### Q: 如何自定义错误格式？

A: 修改 `core/middleware/errorHandler.js` 中的 `onError` 函数

### Q: 如何手动添加中间件？

A: 使用服务器实例的 `use()` 或 `unshift()` 方法：

```javascript
const server = new MerryChristmasServer();

// 添加到中间件堆栈末尾
server.use(async (ctx, next) => {
  console.log('自定义中间件');
  await next();
});

// 添加到中间件堆栈最前面
server.unshift(async (ctx, next) => {
  console.log('最前面的中间件');
  await next();
});
```

### Q: 如何使用中间件命名空间？

A: 通过 `utils.middleware.xxxx` 直接访问：

```javascript
const { middleware } = require('merrychristmas-server');

console.log('内置中间件:', Object.keys(middleware));
console.log('CORS 中间件:', middleware.cors.config);
```

---

## 📞 联系方式

- 问题反馈：[GitHub Issues](https://github.com/NightPoetry/MerryChristmas/issues)
- 邮箱：NightPoetry2025@outlook.com

---

🎄 **Merry Christmas!** 🎅