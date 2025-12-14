
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
├── docs/                          # 文档
│   ├── 路由编写规则手册.md
│   └── 中间件编写规则手册.md
├── modules/                       # 业务模块
│   └── module.js
├── public/                        # 静态文件
├── router/                        # 路由系统
│   ├── middleware/               # 中间件
│   │   ├── logger.js
│   │   ├── jwtAuth.js
│   │   ├── transaction.js
│   │   └── ...
│   ├── private/                  # 私有路由（127.0.0.1）
│   │   └── root/
│   ├── public/                   # 公开路由
│   │   ├── root/
│   │   │   ├── login.js
│   │   │   └── hello.js
│   │   └── api/
│   ├── protected/                # 受保护路由（需JWT）
│   │   └── api/
│   │       └── users/
│   │           └── profile.js
│   └── router.js                 # 路由加载器
├── storage/                      # 存储目录
├── .env.example                  # 环境变量模板
├── .gitignore
├── nodemon.json                  # 开发环境配置
├── package.json
└── server.js                     # 服务器入口
```

---

## 🎯 核心特性

### ✨ 路由系统

- **极简语法** - 无需 `exports`，直接使用 `const` 和 `function`
- **自动加载** - 自动扫描路由文件，无需手动注册
- **文件名即路由** - 文件名自动映射为 URL 路径
- **虚拟主机** - 支持子域名和自定义端口

### 🔧 中间件系统

- **三种模式** - 简单、洋葱、生命周期
- **洋葱模型** - 完整的请求/响应拦截
- **自动排序** - 基于 `order` 字段自动排序
- **路径过滤** - 支持 `exclude` 排除特定路径

### 🛡️ 安全特性

- **JWT 认证** - 内置 JWT 中间件
- **权限控制** - 基于角色和权限的访问控制
- **数据脱敏** - 自动脱敏敏感字段
- **限流保护** - 防止 API 滥用

### 📊 其他特性

- **事务管理** - 自动管理数据库事务
- **审计日志** - 完整的操作日志记录
- **错误处理** - 统一的错误处理机制
- **响应格式化** - 统一的响应格式

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
  const userId = ctx.user.id;
  
  const [user] = ctx.transaction.query(
    'SELECT * FROM users WHERE id = ?',
    [userId]
  );
  
  if (!user) {
    ctx.throw(404, '用户不存在');
  }
  
  return user;
}
```

访问：`GET http://api.localhost:3000/users/profile`

更多示例请查看：[路由编写规则手册](./docs/路由编写规则手册.md)

---

## 🔧 编写中间件

### 简单中间件

创建文件：`router/middleware/logger.js`

```javascript
const config = {
  level: ['global'],
  order: 1
};

function handler(ctx) {
  console.log(`${ctx.method} ${ctx.url}`);
}
```

### 洋葱中间件

创建文件：`router/middleware/transaction.js`

```javascript
const config = {
  level: ['protected'],
  order: 60
};

function before(ctx) {
  ctx.transaction = db.beginTransaction();
}

function after(ctx) {
  if (ctx.status < 400) {
    ctx.transaction.commit();
  } else {
    ctx.transaction.rollback();
  }
}
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

## 🧪 测试

```bash
# 运行所有测试
npm test

# 运行特定测试
npm test -- router.test.js

# 查看覆盖率
npm test -- --coverage
```

---

## 📦 生产部署

### 1. 构建

```bash
# 安装生产依赖
npm install --production
```

### 2. 配置

```bash
# 设置生产环境变量
export NODE_ENV=production
export PORT=3000
export JWT_SECRET=your-production-secret
```

### 3. 启动

```bash
# 使用 PM2（推荐）
pm2 start server.js --name merrychristmas

# 或直接启动
node server.js
```

### 4. PM2 配置（推荐）

创建 `ecosystem.config.js`：

```javascript
module.exports = {
  apps: [{
    name: 'merrychristmas',
    script: './server.js',
    instances: 'max',
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    }
  }]
};
```

启动：

```bash
pm2 start ecosystem.config.js
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

MIT License

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

A: 修改 `router/middleware/errorHandler.js` 中的 `onError` 函数

---

## 📞 联系方式

- 问题反馈：[GitHub Issues](https://github.com/yourname/merrychristmas/issues)
- 邮箱：your.email@example.com

---

🎄 **Merry Christmas!** 🎅