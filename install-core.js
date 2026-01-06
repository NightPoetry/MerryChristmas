#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// 获取当前脚本所在目录
const scriptDir = path.dirname(process.argv[1]);
const coreDir = path.join(scriptDir, 'core');
const targetDir = process.cwd();

console.log('MerryChristmas 核心库本地安装脚本');
console.log(`当前目录: ${targetDir}`);
console.log(`核心库目录: ${coreDir}`);

// 检查核心库目录是否存在
if (!fs.existsSync(coreDir)) {
  console.error('错误: 核心库目录不存在');
  process.exit(1);
}

// 检查核心库的 package.json 是否存在
const corePackageJsonPath = path.join(coreDir, 'package.json');
if (!fs.existsSync(corePackageJsonPath)) {
  console.error('错误: 核心库的 package.json 不存在');
  process.exit(1);
}

// 读取核心库的 package.json
const corePackageJson = JSON.parse(fs.readFileSync(corePackageJsonPath, 'utf8'));
const packageName = corePackageJson.name;
const packageVersion = corePackageJson.version;

console.log(`\n安装 ${packageName} v${packageVersion}...`);

// 检查目标目录是否存在 package.json
const targetPackageJsonPath = path.join(targetDir, 'package.json');
if (!fs.existsSync(targetPackageJsonPath)) {
  console.log('目标目录没有 package.json，正在初始化...');
  try {
    execSync('npm init -y', { cwd: targetDir, stdio: 'inherit' });
  } catch (error) {
    console.error('初始化 package.json 失败:', error.message);
    process.exit(1);
  }
}

// 使用 npm install 本地包的方式安装核心库
console.log('正在安装核心库...');
try {
  execSync(`npm install ${coreDir} --save`, { cwd: targetDir, stdio: 'inherit' });
  console.log('\n✅ 核心库安装成功!');
  console.log(`\n现在你可以在项目中直接使用核心库:`);
  console.log(`const MerryChristmasServer = require('${packageName}');`);
  console.log(`const server = new MerryChristmasServer();`);
} catch (error) {
  console.error('\n❌ 安装失败:', error.message);
  process.exit(1);
}
