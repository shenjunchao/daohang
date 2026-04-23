# 个人自定义导航

这是一个适合部署到 GitHub Pages 的个人导航站，支持：

- 页面静态部署到 GitHub Pages
- 使用 Supabase 实现注册 / 登录
- 每个用户保存自己的导航数据
- 登录后自动云端同步
- 未登录时继续使用浏览器本地缓存
- 导入 / 导出 JSON

## 项目文件

- `index.html`：页面结构
- `styles.css`：页面样式
- `app.js`：前端逻辑与 Supabase 同步
- `supabase-config.js`：Supabase 项目配置
- `supabase-schema.sql`：Supabase 数据表与权限策略

## 本地预览

这是纯静态项目，直接双击 `index.html` 就能预览界面。

更推荐使用本地静态服务器，例如：

```powershell
cd C:\Users\LH\Desktop\daohang
python -m http.server 8080
```

然后打开：

```text
http://localhost:8080
```

## 配置 Supabase

### 1. 创建 Supabase 项目

在 Supabase 后台新建项目。

### 2. 创建数据表

打开 Supabase SQL Editor，执行：

`supabase-schema.sql`

它会创建 `public.user_navigation` 表，并配置 RLS，只允许用户访问自己的导航数据。

### 3. 开启邮箱密码登录

在 Supabase 后台的 Authentication 中启用 Email 登录。

### 4. 填写前端配置

编辑：

`supabase-config.js`

填入你项目的：

- `url`
- `anonKey`

示例：

```js
window.SUPABASE_CONFIG = {
  url: "https://your-project-ref.supabase.co",
  anonKey: "your-anon-key",
};
```

注意：

- 这里使用的是 `anon key`，不是 `service_role key`
- `anon key` 可以放前端
- `service_role key` 绝对不要放到 GitHub Pages

## 发布到 GitHub Pages

### 方法一：直接仓库根目录发布

1. 把整个项目上传到 GitHub 仓库
2. 进入 GitHub 仓库设置
3. 打开 Pages
4. Source 选择当前分支，例如 `main`
5. Folder 选择 `/ (root)`
6. 保存后等待发布

### 方法二：自定义域名

在 GitHub Pages 发布成功后：

1. 在 Pages 设置里填写你的自定义域名
2. 到域名 DNS 服务商添加解析记录
3. 等待生效后即可通过自己的域名访问

## 使用说明

- 未登录时：数据保存在本地浏览器
- 注册成功并登录后：当前导航会同步到云端
- 再次登录同一账号时：会自动拉取该账号自己的导航数据
- 编辑、添加、排序、删除后：会自动同步到 Supabase

## 关于邮箱验证

如果 Supabase 项目开启了邮箱确认：

- 注册后可能需要先去邮箱点验证链接
- 验证完成后再回来登录

如果你想要“注册后立刻登录”，可以在 Supabase 的 Auth 设置中关闭邮箱确认。
