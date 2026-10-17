# 掼蛋生产与恢复基准（2026-10-17）

## 受保护生产版本（不得自动覆盖）
- 正式地址：https://yihua-mu.vercel.app/
- 已确认生产部署：dpl_Drf4s1hQRrKrG1vHapaZmStCh8HS
- 生产 Git SHA：3031e1a2375bb9870b409a17cb240af42cae435c
- 正确水墨首页 `frontend/src/CleanroomEntry.tsx` Git blob：043b563fb4c85dd6609400068dccb402c7caed41
- 正确首页样式 `frontend/src/cleanroom-lobby-artwork.css` Git blob：b1f1e463710ede481c24f12903ad0ae3beb5d7e4
- 禁止发布已拒绝 SHA：06e422f
- 不得修改独立的三游戏 Render 站点或共享后端

## 当前 QA 代码恢复基点
- 当前工作分支：qa/robot-ui-safe-integration-20261017-noon
- 已建立不可依赖预览域名的恢复分支：backup/guandan-guard-fix-20261017-a65cd9dd
- 该备份的准确提交：a65cd9dd0e56245500d56e936caacd9a249580a7
- 更早备份：backup/guandan-protected-20261017-48d6ddc8
- 每次开发必须从远程 QA 分支最新 SHA 创建修改；拒绝旧 SHA 覆盖最新分支
- 每次推送运行 `.github/workflows/guandan-version-protection.yml` 的首页 blob 检查和代码备份

## 快速找回代码（操作前确认当前分支）
```bash
git fetch origin
git switch -c restore/guandan-guard-fix-20261017 origin/backup/guandan-guard-fix-20261017-a65cd9dd
git rev-parse HEAD
# 必须等于 a65cd9dd0e56245500d56e936caacd9a249580a7
```

## 恢复正式网站时的安全门禁
1. 先核对线上 Vercel 域名绑定的部署身份、生产 SHA 和正确首页截图。
2. 仅在获得明确授权并确认完整备份后，才执行生产恢复；不要直接用 QA 分支覆盖正式网站。
3. 完成实际四客户端浏览器和三局 QA、重连、抗贡、机器人和运行状态备份恢复演练。
4. 若无法取得 Vercel token，自动检查只能证明 HTTP 可访问，不能证明域名仍指向批准的部署。
5. Git 分支只备份源代码，不包含 Render/Vercel secrets、数据库或实时牌室数据；运行数据需要另行持久化和恢复演练。

## 自动运行限制
GitHub Actions 的定时 schedule 通常只从默认分支运行；本保护工作流目前在 QA 分支，必须经过安全审查后独立部署到默认分支才能实现真正每小时自动监控。不得把 QA 游戏代码合并到默认分支来实现定时监控。
