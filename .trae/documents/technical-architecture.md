# ESP32S3 智能教室环境监测系统 - 技术架构文档

## 1. 架构设计

```mermaid
flowchart TB
    subgraph 设备端
        ESP["ESP32S3 设备"]
    end
    subgraph 客户端
        WEB["Vue 3 前端<br/>Fluent UI 风格"]
    end
    subgraph 服务端
        API["Node.js + Express<br/>JSON API"]
        MW["中间件层<br/>Token/JWT 鉴权"]
        SVC["服务层<br/>业务逻辑"]
        REPO["数据访问层<br/>node-postgres"]
    end
    subgraph 数据层
        PG[("PostgreSQL<br/>环境数据")]
        ENV[".env<br/>密钥/连接串"]
    end
    ESP -->|"HTTP POST + Token"| MW
    MW --> SVC --> REPO --> PG
    API --> MW
    WEB -->|"HTTP JSON + JWT"| API
    SVC -.-> ENV
```

## 2. 技术说明

- **前端**：Vue@3 + Vue Router@4 + Pinia + Vite + ECharts（自定义 Fluent Design 风格组件）
- **后端**：Node.js + Express@4 + jsonwebtoken + dotenv + cors
- **数据库**：PostgreSQL（通过 node-postgres `pg` 驱动访问）
- **鉴权**：设备上报使用可配置 Token（Bearer）；管理员账号密码存于数据库 `users` 表（pgcrypto bcrypt 哈希），会话使用 JWT
- **配置**：数据库连接串、JWT 密钥等置于 `.env`；管理员凭证存于数据库（见 `schema.sql`）

## 3. 路由定义（前端）

| 路由 | 名称 | 用途 |
|-----|------|------|
| `/login` | 登录页 | 管理员登录 |
| `/dashboard` | 仪表盘 | 最新数据概览 |
| `/history` | 历史数据 | 历史记录查询 |
| `/charts` | 图表分析 | 多维度图表 |
| `/settings` | 系统设置 | Token 与设备管理 |

## 4. API 定义

### 4.1 设备数据上报

```typescript
// POST /api/reports
// Header: Authorization: Bearer <DEVICE_TOKEN>
// Request Body
interface ReportPayload {
  device_id: string;          // 设备标识
  light1?: number;            // 光敏1 ADC 原始值 0-4095
  light2?: number;            // 光敏2 ADC 原始值 0-4095
  aqi?: number;               // 空气质量指数 0-500
  temperature?: number;       // 温度 ℃
  speed?: number;             // 风速 m/s
  presence?: boolean;         // 是否有人
  reported_at?: string;       // 设备本地时间 ISO，缺省用服务端时间
}
// Response 201
{ "ok": true, "id": number }
// Response 401
{ "ok": false, "error": "invalid token" }
```

### 4.2 管理员登录

```typescript
// POST /api/auth/login
// 账号密码存于 users 表，密码用 pgcrypto crypt() + gen_salt('bf',10) 做 bcrypt 哈希
interface LoginReq { username: string; password: string; }
interface LoginRes { ok: true; token: string; username: string; }   // token 为 JWT
// 校验 SQL：SELECT id,username,role FROM users
//          WHERE username=$1 AND password_hash = crypt($2, password_hash)
```

### 4.3 数据查询（需 JWT）

```typescript
// GET /api/reports/latest
interface LatestRes {
  device_id: string;
  light1: number | null;       // 光敏1
  light2: number | null;       // 光敏2
  aqi: number | null;          // AQI
  temperature: number | null;  // 温度 ℃
  speed: number | null;        // 风速 m/s
  presence: boolean | null;    // 是否有人
  reported_at: string;
  received_at: string;
}

// GET /api/reports/history?device_id=&start=&end=&metric=&page=&size=
interface HistoryRes {
  total: number;
  page: number;
  size: number;
  items: LatestRes[];
}

// GET /api/reports/stats?device_id=&start=&end=&metric=&granularity=
// granularity: hour | day | week
interface StatsRes {
  metric: string;
  points: { t: string; avg: number; min: number; max: number; count: number }[];
}
```

### 4.4 设置接口（需 JWT）

```typescript
// GET /api/settings/token  -> { token_masked: string; updated_at: string }
// PUT /api/settings/token   <- { new_token: string } -> { ok: true }
// GET /api/settings/devices -> { devices: { device_id: string; last_seen: string; count: number }[] }
```

## 5. 服务端架构

```mermaid
flowchart LR
    C["Controller<br/>routes/"] --> S["Service<br/>services/"]
    S --> R["Repository<br/>db/"]
    R --> PG[("PostgreSQL")]
    MW["middleware/<br/>authToken / authJwt"] --> C
```

分层职责：
- `routes/`：参数校验、调用 service、返回 JSON
- `services/`：业务逻辑（聚合、统计计算）
- `db/`：SQL 查询封装、连接池
- `middleware/`：设备 Token 校验、管理员 JWT 校验、错误处理

## 6. 数据模型

### 6.1 实体关系

```mermaid
erDiagram
    DEVICE_REPORTS ||--o{ REPORT_INDEX : "device_id 索引"
    DEVICE_REPORTS {
        bigint id PK
        varchar device_id
        int light1
        int light2
        int aqi
        numeric temperature
        numeric speed
        boolean presence
        timestamp reported_at
        timestamp received_at
    }
    APP_SETTINGS {
        varchar key PK
        text value
        timestamp updated_at
    }
```

### 6.2 数据定义语言（DDL）

```sql
-- 环境数据上报表
CREATE TABLE IF NOT EXISTS device_reports (
    id           BIGSERIAL PRIMARY KEY,
    device_id    VARCHAR(64)  NOT NULL,
    light1       INTEGER,              -- 光敏1 ADC 值 0-4095
    light2       INTEGER,              -- 光敏2 ADC 值 0-4095
    aqi          INTEGER,              -- 空气质量指数 0-500
    temperature  NUMERIC(5,2),         -- 温度 ℃
    speed        NUMERIC(5,2),         -- 风速 m/s
    presence     BOOLEAN,              -- 是否有人
    reported_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    received_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reports_device_id   ON device_reports(device_id);
CREATE INDEX IF NOT EXISTS idx_reports_reported_at ON device_reports(reported_at DESC);
CREATE INDEX IF NOT EXISTS idx_reports_device_time ON device_reports(device_id, reported_at DESC);

-- 应用设置表（存储可热更新的设备 Token 等）
CREATE TABLE IF NOT EXISTS app_settings (
    key         VARCHAR(64) PRIMARY KEY,
    value       TEXT        NOT NULL,
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 初始化 Token（首次启动使用 .env 中 INITIAL_DEVICE_TOKEN 写入）
INSERT INTO app_settings(key, value)
VALUES ('device_token', COALESCE(NULLIF(current_setting('app.initial_token', true), ''), 'esp32-default-token'))
ON CONFLICT (key) DO NOTHING;
```

## 7. 目录结构

```
ESP32-WEB/
├── .env                    # 私密配置（不提交）
├── .env.example            # 配置示例
├── .gitignore
├── package.json            # 后端依赖与脚本
├── server/                 # Node.js 后端
│   ├── index.js            # 入口
│   ├── routes/
│   ├── services/
│   ├── db/
│   ├── middleware/
│   └── utils/
└── web/                    # Vue 3 前端
    ├── package.json
    ├── vite.config.js
    ├── index.html
    └── src/
        ├── main.js
        ├── App.vue
        ├── router/
        ├── stores/
        ├── views/
        ├── components/
        ├── api/
        └── assets/
```

## 8. .env 配置项

```
# 服务端
PORT=3000
NODE_ENV=development

# 数据库（连接串格式）
DATABASE_URL=postgresql://postgres:changeme@127.0.0.1:5432/esp32_classroom

# 鉴权
JWT_SECRET=please-change-this-secret
# 管理员账号密码存于数据库 users 表（默认 admin/admin，bcrypt 哈希，见 schema.sql）

# 设备上报 Token 初始值（首次启动写入数据库，之后由管理页修改）
INITIAL_DEVICE_TOKEN=esp32-classroom-token-2026

# 跨域
CORS_ORIGIN=http://localhost:5173
```
