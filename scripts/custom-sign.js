const { execFileSync } = require('child_process');
const path = require('path');
const fs = require('fs');

/**
 * 递归查找所有 .exe 和 .dll 文件
 */
function findSignTargets(dir) {
  let results = [];
  const list = fs.readdirSync(dir);

  list.forEach((file) => {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);

    if (stat && stat.isDirectory()) {
      results = results.concat(findSignTargets(fullPath));
    } else if (/\.(exe|dll)$/i.test(file)) {
      results.push(fullPath);
    }
  });

  return results;
}

/**
 * 签名一个文件
 */
function signFile(filePath, appId) {
  console.log(`→ 正在签名: ${filePath}`);
  execFileSync(
    path.resolve(__dirname, './signtool-v1.0.2.exe'), // 修改为实际路径
    [
      `appId=appName_com.jlcpcb.www`,
      'sign',
      '/n', '\"JiaLiChuang (HongKong) Co., Limited\"',
      '/fd', 'sha256',
      filePath
    ],
    { stdio: 'inherit' }
  );
}

/**
 * electron-builder 自定义签名钩子
 */
module.exports = async function customSign(configuration, options) {
  const appId = 'appName_com.jlcpcb.www';
  const mainFile = configuration.path;
  const baseDir = path.dirname(mainFile); // 一般是 dist/win-unpacked 或 dist/win-x64-unpacked

  console.log(`\n🧾 开始批量签名目录: ${baseDir}`);

  // 查找所有 .exe 和 .dll 文件
  const filesToSign = findSignTargets(baseDir);

  for (const file of filesToSign) {
    try {
      signFile(file, appId);
    } catch (err) {
      console.error(`❌ 签名失败: ${file}`);
      throw err;
    }
  }

  console.log(`✅ 批量签名完成，总计 ${filesToSign.length} 个文件`);
};
