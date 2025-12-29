
# 📘 MerryChristmas 路由系统完整设计文档

## 第一部分：核心设计思路

---

## 1. 极简语法理念

### 问题陈述

传统的 Node.js/Koa 路由框架存在以下问题：

- **冗余导出** - 需要写 `module.exports` 或 `exports`
- **重复声明** - `async` 关键字需要手动写在每个函数上
- **心智负担** - 开发者需要理解 CommonJS/ES6 模块系统
- **代码膨胀** - 相同的代码重复率高（`exports.xxx = async (ctx) => {}`）

### 解决方案

采用**代码执行 + 自动提取**的方式：

1. **不使用 `require` 加载** - 使用 Node.js 的 `vm` 模块在沙箱中执行文件代码
2. **直接变量声明** - 开发者只需写 `const config = {...}` 和 `function name(ctx) {...}`
3. **自动包装 async** - 加载器自动将所有函数包装为 async
4. **自动提取返回值** - 如果函数返回值，自动设置为 `ctx.body`

### 示例对比

**旧方式（冗余）：**
```javascript
module.exports = {
  config: {
    method: 'GET'
  },
  hello: async (ctx) => {
    ctx.body = { message: 'Hello' };
  }
};
```

**新方式（简洁）：**
```javascript
const config = {
  method: 'GET'
};

function hello() {
  return { message: 'Hello' };
}
```

**减少字符数：** 约 35%

---

## 2. 自动文件扫描加载机制

### 设计原则

1. **约定优于配置** - 文件名决定路由路径
2. **零注册** - 无需在任何地方手动注册路由
3. **递归扫描** - 自动扫描目录树，无限层级支持
4. **错误隔离** - 单个路由文件加载失败不影响其他文件

### 文件名到路由的映射

| 文件路径 | 路由方法 | 访问地址 |
|---------|--------|---------|
| `router/public/root/hello.js` | GET | `http://localhost:3000/hello` |
| `router/public/root/login.js` | POST | `http://localhost:3000/login` |
| `router/public/api/status.js` | GET | `http://api.localhost:3000/status` |
| `router/protected/api/users/list.js` | GET | `http://api.localhost:3000/users/list` |
| `router/protected/admin:3001/dashboard.js` | GET | `http://admin.localhost:3001/dashboard` |

### 扫描算法

```
1. 遍历 router/ 目录
2. 找出 private/public/protected 三个安全级别目录
3. 在每个级别中递归扫描
4. 对于每个子目录（子域名或根）：
   - 如果目录名为 "root" → 根域名路由
   - 如果目录名为 "api" → api.localhost 子域名
   - 如果目录名为 "admin:3001" → admin.localhost:3001 自定义端口
5. 递归扫描目录树，文件夹结构转换为 URL 路径
6. 文件名（去掉 .js） 作为最后一段路径
```

---

## 3. 虚拟主机与多端口支持

### 架构设计

```
主应用 (主机 :3000)
├── 根域名路由
├── 中间件层
└── 虚拟主机路由表
    ├── api.localhost
    ├── admin.localhost
    └── dashboard.localhost
    
辅助应用 (主机 :3001)
├── admin.localhost 路由
├── 中间件层
└── 虚拟主机路由表
```

### 虚拟主机实现

1. **域名识别** - 从 `ctx.host` 获取请求的主机名
2. **路由转发** - 根据主机名转发到对应的路由表
3. **中间件隔离** - 每个虚拟主机有独立的中间件堆栈
4. **跨域支持** - 通过 CORS 中间件支持跨域请求

### 自定义端口语法

```
文件路径: router/protected/admin:3001/dashboard.js
解析规则: 目录名 = "admin:3001"
  ├── 域名部分 = "admin"
  └── 端口部分 = "3001"
结果: admin.localhost:3001/dashboard
```

---

## 4. 三层安全级别设计

### 1. Private 路由（私有）

```
特点：
- 只允许 127.0.0.1 访问
- IP 白名单验证
- 用于内部管理、健康检查、调试接口

示例：
router/private/root/debug.js → /debug (仅本地)
router/private/root/metrics.js → /metrics (仅本地)
```

### 2. Public 路由（公开）

```
特点：
- 无需认证
- 允许所有来源访问
- 用于登录、注册、查询等操作

示例：
router/public/root/login.js → /login (全网)
router/public/root/register.js → /register (全网)
router/public/api/status.js → api.localhost/status (全网)
```

### 3. Protected 路由（受保护）

```
特点：
- 需要 JWT 认证
- 需要验证用户角色和权限
- 用于用户操作、数据修改等

示例：
router/protected/api/users/profile.js → api.localhost/users/profile (需JWT)
router/protected/api/posts/create.js → api.localhost/posts/create (需JWT)
```

---

## 5. 洋葱模型中间件系统

### 中间件执行流程

```
HTTP 请求到达
    ↓
┌─────────────────────────────────────────┐
│ onRequest 钩子（可选，最先执行）         │
└─────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────┐
│ before 中间件（请求前处理）              │
│ - JWT 验证                               │
│ - 权限检查                               │
│ - 事务开启                               │
│ - 参数验证                               │
└─────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────┐
│        【业务路由处理函数】              │
│     ctx.body = await handler(ctx)       │
└─────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────┐
│ after 中间件（响应后处理）               │
│ - 数据脱敏                               │
│ - 缓存保存                               │
│ - 响应格式化                             │
│ - 事务提交/回滚                          │
└─────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────┐
│ onResponse 钩子（可选）                  │
│ - 设置响应头                             │
│ - 性能记录                               │
└─────────────────────────────────────────┘
    ↓
HTTP 响应返回
    ↓
┌─────────────────────────────────────────┐
│ onFinish 钩子（异步，响应后执行）        │
│ - 审计日志保存                           │
│ - 监控数据发送                           │
│ - 异步通知                               │
└─────────────────────────────────────────┘
```

### 三种中间件模式

#### 模式 1：Simple（简单）

```javascript
// 适用：单向处理，无需返回处理
const config = { level: ['global'], order: 1 };

function handler(ctx) {
  console.log(ctx.method, ctx.url);
}
```

#### 模式 2：Onion（洋葱）

```javascript
// 适用：请求前后都需要处理
const config = { level: ['protected'], order: 60 };

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

#### 模式 3：Lifecycle（生命周期）

```javascript
// 适用：完整控制请求周期
const config = { level: ['protected'], order: 50 };

function onRequest(ctx) { /* 最先 */ }
function before(ctx) { /* 业务前 */ }
function after(ctx) { /* 业务后 */ }
function onResponse(ctx) { /* 响应前 */ }
function onError(ctx, error) { /* 错误处理 */ }
function onFinish(ctx) { /* 异步回调 */ }
```

---

## 6. 中间件排序与执行规则

### Order 字段含义

```javascript
const config = {
  order: 10  // 执行顺序
};
```

### 排序算法

```
1. 将中间件分为两组：
   - 正序组（order >= 0）
   - 倒序组（order < 0）

2. 正序组按 order 从小到大排序
3. 倒序组按 order 的绝对值从大到小排序

4. 执行顺序：
   正序 → 业务逻辑 → 倒序（反向）

示例：
order: 1   → 第1个执行
order: 10  → 第10个执行
order: -2  → 倒数第2个执行
order: -1  → 最后执行
```

### 推荐 Order 值

```
0   requestId         (生成唯一ID)
1   logger            (请求日志)
5   ipWhitelist       (IP检查)
10  cors              (跨域处理)
11  securityHeaders   (安全头)
20  rateLimit         (限流)
30  cache             (缓存检查)
40  jwtAuth           (JWT验证)
45  bodyValidator     (参数验证)
50  authorization     (权限检查)
60  transaction       (事务管理)
-3  compression       (响应压缩)
-2  responseFormatter (格式化)
-1  errorHandler      (错误处理)
```

---

## 7. 路由配置对象设计

### 核心配置

```javascript
const config = {
  // ===== 必需 =====
  method: 'GET',  // HTTP 方法
  
  // ===== 认证与授权 =====
  requireRoles: ['admin'],           // 所需角色
  requirePermissions: ['user.delete'], // 所需权限
  
  // ===== 数据管理 =====
  transaction: true,                 // 是否启用事务
  
  // ===== 流量控制 =====
  rateLimit: {
    max: 100,        // 最大请求数
    windowMs: 60000  // 时间窗口
  },
  
  // ===== 缓存 =====
  cache: {
    enabled: true,
    ttl: 300  // 缓存时间（秒）
  },
  
  // ===== 审计 =====
  audit: true,
  auditAction: 'CREATE_USER',
  
  // ===== 数据保护 =====
  sensitiveFields: {
    email: ['admin'],
    phone: ['admin'],
    idCard: ['admin']
  },
  
  // ===== 参数验证 =====
  validate: {
    required: ['username', 'password'],
    types: {
      username: 'string',
      password: 'string'
    },
    length: {
      username: { min: 3, max: 20 }
    },
    patterns: {
      email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    }
  },
  
  // ===== 其他 =====
  description: '用户登录',
  deprecated: false
};
```

---

## 8. 加载器实现原理

### VM 模块沙箱执行

```javascript
// 核心思路：不用 require，用 vm 执行代码，使用函数包装提取变量

1. 读取文件内容
   const code = fs.readFileSync(filePath, 'utf-8');

2. 使用函数包装的方式来提取变量（支持 const 声明）
   const fullCode = `
     (function() {
       const extracted = {};
       
       // 执行原始代码
       ${code}
       
       // 提取变量
       if (typeof config !== 'undefined') extracted.config = config;
       if (typeof ${fileName} !== 'undefined') extracted.handler = ${fileName};
       
       return extracted;
     })()`;

3. 创建沙箱环境
   const sandbox = {
     console, require, process,
     __dirname, __filename,
     Buffer, setTimeout, setInterval
   };

4. 在沙箱中执行代码
   const script = new vm.Script(fullCode);
   const extracted = script.runInNewContext(sandbox);

5. 从提取结果中获取变量
   const config = extracted.config;
   const handler = extracted.handler;

6. 自动包装为 async
   const wrappedHandler = async (ctx) => {
     const result = await handler(ctx);
     if (result !== undefined) ctx.body = result;
   };
```

### 优势

- ✅ 支持在沙箱中使用任何全局对象
- ✅ 避免 require 的缓存问题
- ✅ 可以动态重新加载代码
- ✅ 隔离不同文件的作用域
- ✅ 自动自动处理 async/await

---

## 9. 路由加载顺序与优先级

### 加载顺序

```
1. 应用启动
   ↓
2. 加载全局中间件 (level: 'global')
   ↓
3. 创建虚拟主机路由表
   ↓
4. 对于每个虚拟主机 (private/public/protected)：
   a. 加载该级别的中间件
   b. 加载该子域名的所有路由
   c. 注册到 Koa Router
   ↓
5. 应用启动完成
```

### 路由优先级

```
1. 精确匹配优先 (根据 Koa Router 标准)
2. 正则匹配次之
3. 通配符最后

示例：
/users/123    → 优先匹配 /users/:id
/users/admin  → 精确匹配 /users/admin
/posts/*      → 通配符匹配
```

---

## 10. 错误处理与异常机制

### 错误捕获链

```
业务路由 throw Error
    ↓
onError 钩子捕获
    ↓
错误处理中间件
    ↓
格式化错误响应
    ↓
返回统一格式的错误
```

### 统一错误格式

```javascript
{
  success: false,
  error: {
    code: 'USER_NOT_FOUND',
    message: '用户不存在',
    status: 404
  },
  // 开发环境包含堆栈信息
  stack: '...'
}
```

### 错误代码映射

```
400 → BAD_REQUEST
401 → UNAUTHORIZED
403 → FORBIDDEN
404 → NOT_FOUND
429 → TOO_MANY_REQUESTS
500 → INTERNAL_SERVER_ERROR
```

---

## 11. 中间件层级与作用域

### 四层中间件体系

```
Layer 1: Global（全局）
├─ 应用到所有路由
├─ 所有安全级别
└─ 例：日志、错误处理、安全头

Layer 2: 安全级别
├─ Private 中间件
├─ Public 中间件
└─ Protected 中间件
    (JWT认证、权限检查等)

Layer 3: 虚拟主机
├─ api.localhost 中间件
├─ admin.localhost 中间件
└─ 根域名中间件

Layer 4: 路由级别 (在 config 中指定)
├─ 参数验证
├─ 限流配置
└─ 权限要求
```

## 12. 静态资源安全级别

### 静态资源目录结构

```
static/
├── private/          # 私有静态资源（仅内部路由访问）
├── protected/        # 受保护静态资源（仅内部路由访问）
└── public/           # 公共静态资源（直接访问）
```

### 访问控制

1. **私有静态资源**
   - 访问路径：仅通过内部路由访问
   - 访问限制：仅通过私有路由访问，禁止直接外部访问
   - 适用场景：服务器内部资源、敏感配置文件

2. **受保护静态资源**
   - 访问路径：仅通过内部路由访问
   - 访问限制：仅通过受保护路由访问，需要JWT认证
   - 适用场景：用户头像、私人文件

3. **公共静态资源**
   - 访问路径：`/resource.jpg`
   - 访问限制：无需认证，任何人都可以访问
   - 适用场景：网站图片、样式表、JavaScript文件

### 内部路由访问静态资源

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
```

### 配置与使用

通过配置 `staticDir` 可以自定义静态资源目录：

```javascript
const server = new MerryChristmasServer({
  staticDir: './static' // 默认值
});
```

### 实现原理

1. **静态资源中间件**
   - 仅处理公共静态资源的直接访问
   - 禁止直接访问受保护和私有静态资源
   - 防止路径遍历攻击

2. **内部路由访问机制**
   - 在路由处理函数中注入 `ctx.sendFile()` 方法
   - 根据安全级别读取对应的静态资源目录
   - 支持自动设置MIME类型
   - 提供文件存在检查和文件信息获取功能

3. **访问控制规则**
   - 公共静态资源：直接访问
   - 受保护静态资源：仅通过受保护路由访问，需要JWT认证
   - 私有静态资源：仅通过私有路由访问，仅允许本地IP访问

### 中间件 + 路由配置协作

```javascript
// 中间件处理通用逻辑
// router/middleware/authorization.js
function before(ctx) {
  const routeConfig = ctx.state.routeConfig;
  if (routeConfig.requireRoles) {
    // 检查角色
  }
}

// 路由配置指定该路由的特殊需求
// router/protected/api/users/delete.js
const config = {
  method: 'DELETE',
  requireRoles: ['admin'],
  requirePermissions: ['users.delete'],
  audit: true
};
```

---

## 12. 响应格式化与数据脱敏

### 自动格式化

```javascript
// 原始响应
return { id: 1, name: 'John' };

// 自动包装后
{
  success: true,
  data: {
    id: 1,
    name: 'John'
  },
  timestamp: 1672531200000
}
```

### 智能脱敏

```javascript
const config = {
  sensitiveFields: {
    email: ['admin'],        // 只有 admin 能看邮箱
    phone: ['admin'],        // 只有 admin 能看电话
    idCard: ['admin']        // 只有 admin 能看身份证
  }
};

// 普通用户返回的数据
{
  name: 'John',
  email: '***',
  phone: '138****5678',
  idCard: '110101********1234'
}

// Admin 用户返回的数据
{
  name: 'John',
  email: 'john@example.com',
  phone: '13812345678',
  idCard: '110101199001011234'
}
```

---

## 13. 请求验证与参数检查

### 验证链

```
body 中间件解析请求体
    ↓
bodyValidator 中间件检查
    ↓
↓─ 必填字段检查
│─ 类型检查
│─ 长度检查
│─ 正则检查
│─ 自定义函数
    ↓
验证通过 → 业务路由
验证失败 → 400 错误
```

### 验证配置示例

```javascript
const config = {
  method: 'POST',
  validate: {
    // 检查必填字段
    required: ['username', 'password'],
    
    // 检查字段类型
    types: {
      username: 'string',
      password: 'string',
      age: 'number'
    },
    
    // 检查字符串长度
    length: {
      username: { min: 3, max: 20 },
      password: { min: 6, max: 50 }
    },
    
    // 正则表达式检查
    patterns: {
      email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
      phone: /^1[3-9]\d{9}$/
    },
    
    // 自定义验证函数
    custom: (body) => {
      if (body.password !== body.confirm) {
        throw new Error('两次密码不一致');
      }
    }
  }
};
```

---

## 14. 限流与流量控制

### 限流原理

```
1. 生成限流 key = `path:userId`
2. 从内存中查询请求计数
3. 如果计数超过限制 → 返回 429
4. 否则 → 计数加1，继续处理
5. 时间窗口过期 → 重置计数
```

### 配置使用

```javascript
const config = {
  method: 'POST',
  rateLimit: {
    max: 5,           // 最多5次请求
    windowMs: 900000  // 15分钟内
  }
};
```

### 响应头

```
X-RateLimit-Limit: 5           // 限制次数
X-RateLimit-Remaining: 3       // 剩余次数
X-RateLimit-Reset: ISO时间戳   // 重置时间
Retry-After: 秒数               // 建议重试等待时间
```

---

## 15. 缓存机制

### 缓存流程

```
请求到达
    ↓
检查 config.cache.enabled
    ↓
✓ 生成缓存 key = path + query + userId
  检查内存中是否存在
    ✓ 有 → 直接返回（缓存命中）
    ✗ 没 → 继续处理业务
        ↓
    业务处理完毕
        ↓
    检查状态码 (200-299)
        ✓ 成功 → 保存到缓存
        ✗ 失败 → 不缓存
        ↓
    返回响应
```

### 配置与使用

```javascript
const config = {
  method: 'GET',
  cache: {
    enabled: true,
    ttl: 300  // 缓存5分钟
  }
};
```

### 缓存头

```
X-Cache: HIT        // 缓存命中
X-Cache: MISS       // 缓存未命中
X-Cache-Age: 45     // 缓存已存在45秒
```

---

## 16. 审计与操作日志

### 审计流程

```
路由开始执行
    ↓
记录审计信息 (before 钩子)
├─ 时间戳
├─ 用户ID
├─ IP 地址
├─ HTTP 方法和路径
├─ 请求体（脱敏）
└─ 操作类型

业务处理
    ↓
更新审计信息 (after 钩子)
├─ 状态码
├─ 是否成功
├─ 执行时间
└─ 变更内容

响应完成 (onFinish 钩子)
    ↓
异步写入日志文件或数据库
```

### 配置使用

```javascript
const config = {
  method: 'DELETE',
  audit: true,
  auditAction: 'DELETE_USER'
};

function deleteUser(ctx) {
  // ... 业务逻辑
  
  // 记录变更信息
  ctx.state.auditChanges = {
    userId: 123,
    username: 'john'
  };
}
```

---

## 17. 性能监控

### 性能指标收集

```
请求到达 (onRequest)
    │ ↓ 记录 startTime
    │
before 中间件
    │ ↓ 记录 beforeTime
    │
业务处理
    │ ↓ 计算 businessTime
    │
after 中间件
    │ ↓ 记录 afterTime
    │
onResponse 钩子
    │ ↓ 设置响应头
    │ ├─ X-Response-Time: total ms
    │ ├─ X-Business-Time: business ms
    │ └─ X-Middleware-Time: middleware ms
    │
onFinish 钩子 (异步)
    └─ 发送到监控系统
```

### 慢请求告警

```javascript
const SLOW_REQUEST_THRESHOLD = 1000; // 1秒

if (total > SLOW_REQUEST_THRESHOLD) {
  console.warn(`🐌 慢请求: ${ctx.method} ${ctx.url} - ${total}ms`);
}
```

---

## 18. JWT 认证机制

### Token 生成

```javascript
const token = jwt.sign(
  {
    id: user.id,
    username: user.username,
    roles: user.roles,      // ['admin', 'user']
    permissions: user.permissions  // ['users.read', 'posts.create']
  },
  process.env.JWT_SECRET,
  { expiresIn: '24h' }
);
```

### Token 验证流程

```
请求到达
    ↓
提取 Authorization 头
    ├─ 格式: "Bearer eyJhbG..."
    └─ 提取 Token
    ↓
验证签名
    ├─ 使用 JWT_SECRET 验证
    └─ 失败 → 401
    ↓
检查过期时间
    ├─ 如果过期 → 401
    └─ 未过期 → 继续
    ↓
解析 payload
    ↓
注入到 ctx.user
    ├─ ctx.user.id
    ├─ ctx.user.roles
    └─ ctx.user.permissions
    ↓
继续处理请求
```

---

## 19. 权限检查与数据脱敏

### 权限验证顺序

```
1. 检查 requireRoles
   ├─ 用户角色 ∩ 所需角色 ≠ ∅
   └─ 如果无 → 403 INSUFFICIENT_ROLE

2. 检查 requirePermissions
   ├─ 用户权限 ⊃ 所需权限
   └─ 如果无 → 403 INSUFFICIENT_PERMISSION

3. 都通过 → 处理请求
```

### 数据脱敏逻辑

```javascript
for (field, allowedRoles) in sensitiveFields:
  if user.roles ∩ allowedRoles = ∅:  // 用户角色无交集
    if field == 'email':
      mask(value, 'u***@example.com')
    elif field == 'phone':
      mask(value, '138****5678')
    elif field == 'idCard':
      mask(value, '110101********1234')
    else:
      mask(value, '***')
```

---

## 20. 事务管理

### 事务生命周期

```
请求到达
    ↓
before 中间件 - 开启事务
├─ BEGIN TRANSACTION
└─ ctx.transaction 注入
    ↓
业务路由执行
├─ 可以调用 ctx.transaction.query()
└─ 所有操作在同一事务中
    ↓
after 中间件 - 事务处理
├─ 如果 status < 400 → COMMIT
├─ 如果 status >= 400 → ROLLBACK
└─ onError 中自动 ROLLBACK
    ↓
事务结束
```

### 配置控制

```javascript
// 启用事务（默认）
const config = {
  transaction: true
};

// 禁用事务
const config = {
  transaction: false
};
```

---

## 21. 跨域处理

### CORS 规则

```
开发环境（NODE_ENV=development）
└─ 允许所有源

生产环境（NODE_ENV=production）
└─ 只允许白名单源
   ├─ http://localhost:3000
   ├─ http://localhost:3001
   ├─ http://localhost:8080
   └─ https://example.com

不同源间的请求
├─ OPTIONS 预检请求 → 204 No Content
└─ 实际请求 → 正常处理
```

### 响应头

```
Access-Control-Allow-Origin: *
Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS
Access-Control-Allow-Headers: Content-Type, Authorization
Access-Control-Allow-Credentials: true
Access-Control-Max-Age: 86400
```

---

## 22. 安全响应头

### 防护措施

| 头字段 | 作用 | 值 |
|--------|------|-----|
| X-Frame-Options | 防点击劫持 | DENY |
| X-Content-Type-Options | 防 MIME 嗅探 | nosniff |
| X-XSS-Protection | XSS 防护 | 1; mode=block |
| Content-Security-Policy | 内容安全策略 | 详见配置 |
| Strict-Transport-Security | HTTPS 强制 | max-age=31536000 |
| Referrer-Policy | 引用策略 | strict-origin-when-cross-origin |
| Permissions-Policy | 权限政策 | geolocation=(), microphone=() |

---

## 23. 响应压缩

### 压缩流程

```
生成响应体
    ↓
检查 Content-Type
├─ text/* → 压缩
├─ application/json → 压缩
├─ application/javascript → 压缩
└─ 其他二进制 → 不压缩
    ↓
检查响应大小
├─ > 1024 字节 → 使用压缩
└─ <= 1024 字节 → 不压缩（无效）
    ↓
选择算法
├─ 支持 gzip → gzip
├─ 支持 deflate → deflate
└─ 都不支持 → 不压缩
    ↓
设置 Content-Encoding 头
    ↓
返回压缩后的响应体
```

---

## 24. 请求 ID 追踪

### ID 生成

```javascript
// 格式：timestamp-randomhex
// 例：jkqp7o-a3f2b1c4d5e6
const requestId = `${timestamp}-${randomHex}`;
```

### 使用场景

```
└─ X-Request-ID 响应头
   ├─ 日志追踪
   ├─ 错误排查
   ├─ 性能分析
   └─ 分布式追踪
```

---

## 25. 路由系统完整流程图

```
HTTP 请求到达服务器
    ↓
requestId 中间件 (order: 0)
├─ 生成请求 ID
└─ 设置 X-Request-ID 头
    ↓
logger 中间件 (order: 1)
├─ 记录请求方法、URL、IP
└─ 设置响应完成监听
    ↓
cors 中间件 (order: 10)
├─ 检查 Origin
├─ 处理 OPTIONS 预检
└─ 设置 CORS 头
    ↓
securityHeaders 中间件 (order: 11)
├─ 设置 X-Frame-Options
├─ 设置 X-XSS-Protection
└─ 设置 CSP 等安全头
    ↓
rateLimit 中间件 (order: 20)
├─ 生成限流 key
├─ 检查请求计数
└─ 超限 → 429
    ↓
cache 中间件 (order: 30)
├─ 检查缓存
├─ 缓存命中 → 直接返回（跳过业务）
└─ 缓存未命中 → 继续
    ↓
jwtAuth 中间件 (order: 40)
├─ 提取 Token
├─ 验证签名和过期时间
└─ 解析到 ctx.user
    ↓
bodyValidator 中间件 (order: 45)
├─ 验证必填字段
├─ 验证字段类型
├─ 验证字段长度和格式
└─ 验证失败 → 400
    ↓
authorization 中间件 (order: 50)
├─ 检查 requireRoles
├─ 检查 requirePermissions
└─ 权限不足 → 403
    ↓
transaction 中间件 before (order: 60)
├─ 开启数据库事务
└─ ctx.transaction 注入
    ↓
audit 中间件 before (order: 2)
├─ 记录审计信息
└─ 保存请求详情
    ↓
    【业务路由处理函数】
    ├─ 执行业务逻辑
    ├─ 返回数据 → ctx.body
    └─ 可能抛出异常
    ↓
【异常捕获】
├─ 有异常 → onError 钩子
│   ├─ authorization onError
│   ├─ transaction onError（回滚）
│   ├─ audit onError
│   └─ errorHandler（格式化错误）
└─ 无异常 → 继续
    ↓
transaction 中间件 after (order: 60)
├─ 检查响应状态
├─ status < 400 → COMMIT
└─ status >= 400 → ROLLBACK
    ↓
authorization 中间件 after (order: 50)
├─ 数据脱敏
└─ 根据 sensitiveFields 处理
    ↓
cache 中间件 after (order: 30)
├─ 检查是否需要缓存
├─ status 200-299 → 保存缓存
└─ 其他 → 不缓存
    ↓
audit 中间件 after (order: 2)
├─ 更新审计信息
├─ 记录状态码和执行时间
└─ 准备异步写入
    ↓
responseFormatter 中间件 after (order: -2)
├─ 检查响应是否已格式化
└─ 包装为标准格式：
   {
     success: true,
     data: ctx.body,
     timestamp: Date.now()
   }
    ↓
errorHandler 中间件 onError (order: -1)
└─ 如果有异常未捕获
   ├─ 记录错误日志
   └─ 返回标准错误格式
    ↓
compression 中间件 (order: -3)
├─ 检查 Content-Type
├─ 如果是文本类型 → gzip 压缩
└─ 设置 Content-Encoding 头
    ↓
HTTP 响应返回客户端
    ↓
【异步回调】（不阻塞响应）
├─ audit 中间件 onFinish
│   └─ 异步写入审计日志到文件/数据库
└─ performance 中间件 onFinish
    └─ 异步发送性能数据到监控系统
```

---

---

# 第二部分：AI 指导模块（核心规则与构建指南）

> 下方内容供 AI 系统参考，用于理解和复现该路由框架的架构。

## 🤖 AI 系统构建指南

### 核心原则（5条）

1. **极简优先** - 移除一切不必要的代码和概念，每个字符都有意义
2. **自动化驱动** - 尽可能减少手工配置，用代码生成代替
3. **分层隔离** - 中间件、路由、业务逻辑清晰分离
4. **约定优于配置** - 文件名、目录名自动转换为配置
5. **失败隔离** - 单点故障不影响整体系统

### 三大支柱

**支柱1：VM 沙箱加载**
- 使用 Node.js `vm` 模块执行代码，无需 `require`
- 自动从沙箱提取 `const config` 和 `function name`
- 自动包装为 `async`，支持返回值自动设置 `ctx.body`

**支柱2：文件结构映射**
- `router/[安全级别]/[子域名]/[路径]/[文件名].js`
- 文件名转换为最后一段 URL 路径
- 目录结构转换为 URL 路径
- 特殊目录名：`root`（根域名）、`admin:3001`（自定义端口）

**支柱3：洋葱模型中间件**
- 统一的 `before → 业务 → after` 流程
- 支持 `onRequest`、`onError`、`onFinish` 钩子
- 基于 `order` 字段自动排序
- 通过 `level` 控制作用范围

### 关键模块（必须实现）

```
┌─ 核心加载器 (router.js)
│  ├─ loadRouteFile()          // 加载单个路由文件
│  ├─ loadMiddlewareFile()     // 加载中间件文件
│  ├─ scanDirectoryRecursive() // 递归扫描目录
│  ├─ composeMiddlewares()     // 组合中间件堆栈
│  ├─ initializeRoutes()       // 初始化整个系统
│  └─ 虚拟主机管理
│
├─ 中间件系统 (middleware/)
│  ├─ logger.js                // 必须：请求日志
│  ├─ cors.js                  // 必须：跨域处理
│  ├─ errorHandler.js          // 必须：错误处理
│  ├─ responseFormatter.js     // 必须：格式化
│  ├─ jwtAuth.js               // 可选：JWT 认证
│  ├─ authorization.js         // 可选：权限检查
│  ├─ transaction.js           // 可选：事务管理
│  └─ ... 其他中间件
│
└─ 服务器启动 (server.js)
   ├─ bodyParser 中间件
   ├─ static 静态服务（支持不同安全级别）
   ├─ initializeRoutes()
   └─ 错误处理和优雅关闭
```

### 执行流程（简化版）

```
应用启动
  │
  ├─→ 加载全局中间件
  │
  ├─→ 扫描 router/ 目录
  │   ├─ private/
  │   ├─ public/
  │   └─ protected/
  │
  ├─→ 对于每个安全级别
  │   ├─ 加载该级别中间件
  │   ├─ 扫描子域名目录
  │   └─ 为每个子域名创建虚拟主机
  │
  └─→ 启动 HTTP 服务
```

### 配置驱动的行为

```javascript
// 中间件通过 config.level 决定作用范围
config = {
  level: ['protected'],      // 作用范围
  order: 50,                 // 执行顺序
  enabled: true,             // 启用/禁用
  exclude: ['/health']       // 排除路径
}

// 路由通过 config 指定需求
config = {
  method: 'POST',                    // HTTP 方法
  requireRoles: ['admin'],           // 角色要求
  requirePermissions: ['user.read'], // 权限要求
  transaction: true,                 // 事务需求
  rateLimit: { max: 100 },          // 限流配置
  cache: { ttl: 300 },              // 缓存配置
  audit: true,                       // 审计需求
  validate: { ... }                  // 验证规则
}
```

### 中间件执行链（关键算法）

```javascript
// 1. 收集同一类型的中间件（如 before）
beforeMiddlewares = []
for mw in middlewareList:
  if mw.config.level in currentLevel and mw.enabled:
    beforeMiddlewares.push(mw.module.before)

// 2. 按 order 排序
beforeMiddlewares.sort(compareFn)

// 3. 串行执行
for handler in beforeMiddlewares:
  await handler(ctx)

// 4. 执行业务路由
await routeHandler(ctx)

// 5. 倒序执行 after 中间件
afterMiddlewares.reverse()
for handler in afterMiddlewares:
  await handler(ctx)
```

### 关键设计决策

| 决策 | 原因 | 权衡 |
|------|------|------|
| VM 模块 | 避免 require 缓存 | 略微性能开销 |
| 文件名映射 | 减少配置 | 灵活性有限 |
| Order 字段 | 精确控制顺序 | 需要记住顺序值 |
| 前/后中间件 | 支持洋葱模型 | 实现复杂 |
| 异步 onFinish | 不阻塞响应 | 审计可能不完整 |
| 内存缓存 | 开发方便 | 生产应用 Redis |

### 扩展建议

```
若要扩展此系统：
1. 中间件 → 直接添加新文件
2. 路由 → 直接添加新文件  
3. 安全级别 → 修改 loadMiddlewares() 和 initializeRoutes()
4. 子域名 → 自动支持，无需修改
5. 端口支持 → 修改 parsePortFromFolderName()
6. 数据库 → 在 transaction 中间件注入
7. 缓存系统 → 替换 cache.js 中的 Map 为 Redis
```

### 测试要点

```
单元测试：
- 路由文件加载
- 中间件排序
- 虚拟主机映射
- 错误处理

集成测试：
- 完整请求流程
- JWT 认证链
- 中间件执行顺序
- 事务回滚

压力测试：
- 限流保护
- 缓存效率
- 内存泄漏
```

### 性能优化策略

```
1. 启动时 → 预加载所有路由和中间件
2. 运行时 → 缓存中间件编译结果
3. 内存 → 定期清理过期缓存
4. 响应 → 启用 gzip 压缩
5. 数据库 → 使用连接池（不涉及框架）
6. 监控 → 记录慢请求（> 1 秒）
```

### 常见陷阱与解决

```
问题：中间件加载顺序混乱
→ 检查 order 值，确保无重复

问题：JWT 验证失败
→ 检查 JWT_SECRET 环境变量

问题：虚拟主机无效
→ 在 /etc/hosts 添加域名解析

问题：缓存过期不清理
→ 启用定期清理任务（300秒）

问题：事务未生效
→ 确保中间件 enabled: true

问题：权限一直拒绝
→ 检查 requireRoles/requirePermissions 配置
```

---

**本文档完成 ✅**

最后更新：2024年
版本：1.0
