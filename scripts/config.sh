#!/bin/bash

# App Store 发布配置文件
# 请根据你的实际情况修改这些配置

# Apple Developer 账户信息
export APPLE_ID="1140457303@qq.com"
export APP_SPECIFIC_PASSWORD="oznl-zlce-kapq-nyjd"
export TEAM_ID="FPD7225NBW"

# 应用信息
export BUNDLE_ID="com.jlcpcb.www"
export APP_NAME="JLCONE"

# 可选配置
export SKIP_NOTARIZATION=true   # App Store 包通常不需要预先公证
export AUTO_UPLOAD=true         # 设置为 false 只打包不上传
export USE_ALTOOL=false         # 设置为 true 强制使用命令行上传