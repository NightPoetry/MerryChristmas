#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// CLI 命令处理函数
function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  const targetDir = args[1] || process.cwd();

  switch (command) {
    case 'init':
      initializeProject(targetDir);
      break;
    case 'help':
    case '-h':
    case '--help':
      showHelp();
      break;
    case 'version':
    case '-v':
    case '--version':
      showVersion();
      break;
    default:
      console.error(`未知命令: ${command}`);
      showHelp();
      process.exit(1);
  }
}

// 初始化项目结构
function initializeProject(targetDir) {
  console.log(`正在 ${targetDir} 创建默认项目结构...`);

  // 默认文件夹结构
  const folders = [
    'router/private',
    'router/public',
    'router/protected/root',
    'router/protected/api',
    'storage/private',
    'storage/protected',
    'storage/public',
    'static/private',
    'static/protected',
    'static/public',
    'middleware'
  ];

  // 创建文件夹
  folders.forEach(folder => {
    const fullPath = path.join(targetDir, folder);
    try {
      fs.mkdirSync(fullPath, { recursive: true });
      console.log(`✓ 创建文件夹: ${folder}`);
    } catch (error) {
      console.error(`✗ 创建文件夹失败: ${folder} - ${error.message}`);
    }
  });

  // 创建示例路由文件
  createExampleFiles(targetDir);

  console.log('\n项目结构创建完成！');
  console.log('\n下一步：');
  console.log('1. 安装依赖: npm install merrychristmas-server');
  console.log('2. 创建主入口文件，实例化并启动服务器');
  console.log('3. 编写路由文件（在 router/ 目录下）');
  console.log('4. 编写自定义中间件（可选，在 middleware/ 目录下）');
}

// 创建示例文件
function createExampleFiles(targetDir) {
  // 创建示例路由文件
  const exampleRouterContent = `const config = {
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
}`;

  // 创建示例服务器入口文件
  const exampleServerContent = `const MerryChristmasServer = require('merrychristmas-server');

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
    console.log('访问地址: http://localhost:3000');
  })
  .catch(error => {
    console.error('服务器启动失败:', error.message);
  });`;

  try {
    // 创建示例路由文件
    const routerPath = path.join(targetDir, 'router', 'public', 'root', 'index.js');
    fs.writeFileSync(routerPath, exampleRouterContent);
    console.log('✓ 创建示例路由文件: router/public/root/index.js');

    // 创建示例服务器文件
    const serverPath = path.join(targetDir, 'server.js');
    fs.writeFileSync(serverPath, exampleServerContent);
    console.log('✓ 创建示例服务器文件: server.js');

    // 创建 package.json 示例
    const packageJsonPath = path.join(targetDir, 'package.json');
    if (!fs.existsSync(packageJsonPath)) {
      const packageJsonContent = JSON.stringify({
        "name": "merrychristmas-app",
        "version": "1.0.0",
        "description": "Merry Christmas Server Application",
        "main": "server.js",
        "scripts": {
          "start": "node server.js",
          "dev": "nodemon server.js"
        },
        "dependencies": {
          "merrychristmas-server": "^1.0.0"
        },
        "devDependencies": {
          "nodemon": "^3.0.0"
        }
      }, null, 2);
      fs.writeFileSync(packageJsonPath, packageJsonContent);
      console.log('✓ 创建示例 package.json: package.json');
    }
  } catch (error) {
    console.error(`✗ 创建示例文件失败: ${error.message}`);
  }
}

// 显示帮助信息
function showHelp() {
  console.log(`MerryChristmas Server CLI 工具\n`);
  console.log(`用法: merrychristmas <command> [options]\n`);
  console.log(`命令:`);
  console.log(`  init [directory]    创建默认项目结构`);
  console.log(`  help                显示帮助信息`);
  console.log(`  version             显示版本信息\n`);
  console.log(`示例:`);
  console.log(`  merrychristmas init          # 在当前目录创建项目结构`);
  console.log(`  merrychristmas init my-app   # 在 my-app 目录创建项目结构`);
}

// 显示版本信息
function showVersion() {
  const packageJson = require('./package.json');
  console.log(packageJson.version);
}

// 执行主函数
main();
