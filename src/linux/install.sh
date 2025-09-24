#!/bin/bash
echo "------------安装开始------------"
rm -rf /opt/JLCONE
cp -rf JLCONE /opt/JLCONE
chmod -R 755 /opt/JLCONE
cp /opt/JLCONE/JLCONE.dkt /usr/share/applications/JLCONE.desktop
echo "------------安装成功，请在启动器打开------------"

