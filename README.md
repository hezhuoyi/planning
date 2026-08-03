# Planning

用时间轴安排家庭生活。未配置 Supabase 时会使用浏览器本地存储，可直接离线使用。

## 启动

```bash
npm install
npm run dev
```

## 可选：Supabase 云同步（家庭口令）

1. 在 Supabase SQL Editor 执行 `supabase/schema.sql`（已有旧表则执行 `supabase/migrate-to-passcode.sql`）。
2. 应用内点「输入口令同步」，口令默认是 `wang`（可在 `src/lib/supabase.ts` 的 `FAMILY_PASSCODE` 修改）。
3. 口令正确后，各设备共用同一份云端计划，无需邮箱登录。

未解锁时只使用本机存储。

生产构建：`npm run build`。

## GitHub Pages

推送到 `main` 后由 GitHub Actions 自动发布已构建的 `dist`：

`https://hezhuoyi.github.io/planning/`

本地验证 Pages 构建：

```bash
VITE_BASE_PATH=/planning/ npm run build
npm run verify:pages
git add -f dist
```
