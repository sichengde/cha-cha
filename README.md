# 班班通丨线上收集

基于微信小程序的轻量化信息查询平台。管理员上传 Excel 表格即可生成查询页面，用户通过分享链接或二维码查询自己的数据，支持信息修改与签收确认。

---

## 项目结构

```
cha-cha/
├── cha-cha-front/          # 微信小程序前端
│   ├── pages/              # 页面
│   │   ├── index/          # 首页（上传、最近查询）
│   │   ├── create/         # 创建流程（preview → condition → settings → success）
│   │   ├── query/          # 用户查询页
│   │   ├── manage/         # 管理页（含数据统计 stats/）
│   │   ├── myqueries/      # 我的查询列表
│   │   ├── usercenter/     # 个人中心
│   │   ├── login/          # 登录
│   │   └── about/          # 关于
│   └── utils/
│       ├── api.js          # 请求封装 + 所有 API 定义
│       └── util.js         # 公共工具函数
│
└── cha-cha-server/         # Node.js 后端
    └── src/
        ├── app.js          # Express 入口
        ├── config/         # 环境变量、数据库、JWT 配置
        ├── controllers/    # 业务逻辑
        ├── routes/         # 路由定义
        ├── services/       # 微信 API 服务
        ├── database/
        │   ├── init.js     # 数据库初始化脚本（含建表 SQL）
        │   └── clear_data.js  # 清空数据脚本（需设置环境变量）
        └── utils/
```

---

## 快速开始

### 环境要求

- Node.js 18+
- MySQL 5.7+ / 8.0
- 微信开发者工具

### 1. 配置后端环境变量

在 `cha-cha-server/` 目录下创建 `.env` 文件：

```env
PORT=3000

# 数据库
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=cha_cha

# JWT
JWT_SECRET=your_jwt_secret_key
JWT_EXPIRES_IN=7d

# 微信小程序
WECHAT_APPID=your_appid
WECHAT_APP_SECRET=your_app_secret
WECHAT_ENV_VERSION=release   # release | trial | develop

# CORS（可选，多个域名用英文逗号分隔）
CORS_ORIGIN=https://your-domain.com
```

### 2. 初始化数据库

```bash
cd cha-cha-server
npm install
npm run init-db
```

脚本会自动：
- 创建数据库（如不存在）
- 创建所有表和索引
- 对已有库执行幂等的索引补建

> **重建数据库**：先在 MySQL 中执行 `DROP DATABASE cha_cha;`，再重新运行 `npm run init-db` 即可。

### 3. 启动后端

```bash
npm start          # 生产模式
npm run dev        # 开发模式（nodemon 热重载）
```

服务启动后访问 `http://localhost:3000/chacha/` 可验证是否正常。

### 4. 配置前端

用微信开发者工具打开 `cha-cha-front/` 目录，前端会自动根据运行环境（开发版/体验版/正式版）选择对应的 API 地址，无需手动修改。

---

## 数据库表结构

共 7 张表，外键均设置 `ON DELETE CASCADE`：

| 表名 | 说明 |
|------|------|
| `users` | 用户（微信 openid 关联） |
| `query_pages` | 查询页面配置（含权限、时间限制等） |
| `query_data` | Excel 数据行（JSON 存储） |
| `query_headers` | 列头配置（查询条件、可修改字段等） |
| `query_records` | 查询记录（唯一约束防重复统计） |
| `signatures` | 签收记录（唯一约束防重复签收） |
| `data_modifications` | 数据修改审计日志 |
| `export_records` | 导出记录 |

完整建表 SQL 见 [`src/database/init.js`](cha-cha-server/src/database/init.js) 中的 `SCHEMA_SQL` 数组。

---

## API 概览

所有路由以 `/chacha/api` 为前缀，`*` 表示需要 JWT 认证。

### 用户 `/users`

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/users/login` | 微信登录（code 换 openid，自动注册） |
| GET | `/users/info` * | 获取当前用户信息 |
| PUT | `/users/info` * | 更新用户信息 |

### 查询页面 `/queries`

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/queries` * | 创建查询页面 |
| GET | `/queries/my` * | 我创建的查询列表 |
| GET | `/queries/:id` | 获取查询页面详情 |
| GET | `/queries/:id/share` | 获取分享信息 |
| GET | `/queries/:id/qrcode` | 生成小程序二维码 |
| PUT | `/queries/:id` * | 更新查询页面 |
| DELETE | `/queries/:id` * | 删除查询页面 |

### 数据查询 `/queries`

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/queries/:id/query` | 按条件查询数据 |
| PUT | `/queries/:id/data/:dataId` * | 修改数据行 |
| POST | `/queries/:id/data/:dataId/sign` * | 签收确认 |

### 统计 `/stats`

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/stats/:id` * | 查询页面统计概览 |
| GET | `/stats/:id/all` * | 全部数据列表 |
| GET | `/stats/:id/queried` * | 已查询列表 |
| GET | `/stats/:id/unqueried` * | 未查询列表 |
| GET | `/stats/:id/signed` * | 已签收列表 |
| GET | `/stats/:id/unsigned` * | 未签收列表 |

### 文件 `/files`

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/files/upload` * | 上传 Excel 文件并解析预览 |
| GET | `/files/export/:id` * | 导出查询数据为 Excel |
| DELETE | `/files/temp/:fileId` * | 删除临时上传文件 |

---

## 清空数据

仅在开发/测试环境使用，**操作不可逆**：

```bash
ALLOW_CLEAR_DATA=true node src/database/clear_data.js
```

---

## 部署说明

- 上传文件目录：`cha-cha-server/uploads/`（自动创建）
- 导出文件目录：`cha-cha-server/exports/`（自动创建）
- 两个目录均已配置静态文件服务，无需额外 Nginx 配置
- 建议在反向代理（Nginx）层限制 `/chacha/uploads` 和 `/chacha/exports` 的直接访问
