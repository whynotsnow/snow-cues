Snow Cues 桌面保存包

1. 解压本 zip。
2. 编辑 storageData-path.txt，把第一行非注释内容改成你的 storageData 文件夹绝对路径。
3. macOS 双击 apply-save.command；Linux 执行 sh apply-save.sh；Windows 使用 PowerShell 执行 apply-save.ps1。
4. 脚本会先检查目标 current.json 的 revision/contentHash，匹配才覆盖 current.json；不匹配时只写入 conflicts/。
5. 脚本不会联网，不读取密码或密钥，不删除 current.json 或 conflicts/。
