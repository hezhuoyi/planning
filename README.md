# Planning

用时间轴安排家庭生活。未配置 Supabase 时会使用浏览器本地存储，可直接离线使用。

## 启动

```bash
npm install
npm run dev
```

## 可选：Supabase 云同步

1. 在 Supabase SQL Editor 执行 `supabase/schema.sql`。
2. 将项目 URL 和 anon key 填入应用的“云同步”对话框；也可复制 `.env.example` 为 `.env.local` 后填写。
3. 本地使用邮箱魔法链接时，在 Supabase Auth URL Configuration 中添加 `http://localhost:5173`。

生产构建：`npm run build`。

## GitHub Pages

推送到 `main` 后由 GitHub Actions 自动部署：

`https://hezhuoyi.github.io/planning/`

本地验证 Pages 构建：

```bash
VITE_BASE_PATH=/planning/ npm run build
npm run verify:pages
```
