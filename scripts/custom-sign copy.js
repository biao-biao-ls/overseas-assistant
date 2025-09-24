const { execFileSync } = require('child_process');
const path = require('path');

/**
 * electron-builder 签名钩子函数
 * @param {*} configuration
 * @param {*} options 包括待签名文件路径
 */
module.exports = async function customSign(configuration, options) {
  const filePath = configuration.path;
  const appId = 'com.jlcpcb.www';

  console.log(`[签名] 使用自定义 signtool 对 ${filePath} 签名...`);

  try {
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
    console.log(`[签名成功] ${filePath}`);
  } catch (err) {
    console.error(`[签名失败] ${filePath}`, err);
    throw err;
  }
};
