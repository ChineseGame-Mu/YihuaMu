# CRITICAL：掼蛋专用生产恢复点

> **最高重要级备份，请勿删除。**

## 标识

- 备份日期：2026-09-30（America/New_York）
- 生产网址：https://yihua-mu.vercel.app
- 完整生产提交：`559a1e5a111668744808ec9b684001d83e426d42`
- 纯净关键备份分支：`backup/CRITICAL-guandan-production-2026-09-30-559a1e5a`
- Vercel 生产部署 ID：`dpl_Eco947Uoqz4uUn52Y9aW6PPzQAjh`
- 不可变部署网址：https://yihua-q6tflhi37-chinese-game.vercel.app

## 本恢复点包含

1. 抗贡提示在整轮内保持显示，进入下一轮后才清除。
2. 四人局同队占第 1、2 名时立即结束，并按双上结算。
3. “选中此组”和“一键出此组”位于“前移”上方。
4. 掼蛋专用入口及牌桌大厅完整代码。
5. 三牌入口代码及部署未修改。

## 验证记录

- Vercel 生产构建：`READY`
- GitHub/Vercel 状态：`success`
- 生产浏览器 QA：连接、四人入桌、发牌、开局、自动理牌正常
- 工具栏实测：`选中此组 → 一键出此组 → 前移`
- 纯净备份与生产提交：完全一致

## 快速恢复

### 首选：按部署 ID 回滚

```bash
vercel rollback dpl_Eco947Uoqz4uUn52Y9aW6PPzQAjh
```

### 从源码恢复

1. 从 `backup/CRITICAL-guandan-production-2026-09-30-559a1e5a` 新建恢复分支。
2. 确认 HEAD 是 `559a1e5a111668744808ec9b684001d83e426d42`。
3. 等待 Vercel 预览构建达到 `READY`。
4. 验收掼蛋入口、四人入桌、发牌、自动理牌和本文件列出的三个改动。
5. 将通过验收的同一部署 Promote to Production。

## 安全边界

恢复时只操作 Vercel 项目 `yihua-mu`，不要修改三牌入口项目。
