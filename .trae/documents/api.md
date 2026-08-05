# ESP32S3 智能教室环境监测系统 · API 文档

- **Base URL**：`http://<服务器IP>:3001/api`
- **请求/响应**：`application/json; charset=utf-8`
- **鉴权**：设备上报用 `Authorization: Bearer <设备Token>`；管理查询用 `Authorization: Bearer <JWT>`（登录获取，12h 有效）

---

## 1. 数据上报 `POST /api/reports`

ESP32 采集传感器数据后上报，服务端校验设备 Token 后写入 PostgreSQL。

### 请求体

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `device_id` | string | 是 | 设备唯一标识 |
| `light1` | number | 否 | 光敏 1 亮度百分比（0–100） |
| `light2` | number | 否 | 光敏 2 亮度百分比（0–100） |
| `light1_adc` | number | 否 | 光敏 1 ADC 原始值（0–4095） |
| `light2_adc` | number | 否 | 光敏 2 ADC 原始值（0–4095） |
| `aqi` | number | 否 | 空气质量指数（0–500） |
| `temperature` | number | 否 | 温度（℃） |
| `presence` | boolean | 否 | 是否检测到有人 |
| `reported_at` | string | 否 | 上报时间（ISO 8601），不传则用服务端时间 |

> 除 `device_id` 外均可省略，未上报字段存为 NULL。

### 响应

```json
// 201
{ "ok": true, "id": 128 }
```

### 错误码

| HTTP | error | 原因 |
|------|-------|------|
| 400 | `device_id is required` | 缺少 device_id |
| 401 | `missing token` / `invalid token` | 未携带或 Token 错误/已轮换 |
| 500 | `insert failed` | 数据库写入失败 |

### cURL 示例

```bash
curl -X POST http://localhost:3001/api/reports \
  -H "Authorization: Bearer <设备Token>" \
  -H "Content-Type: application/json" \
  -d '{
    "device_id": "classroom-101",
    "light1": 73.5,
    "light2": 60.2,
    "light1_adc": 2048,
    "light2_adc": 1850,
    "aqi": 65,
    "temperature": 24.5,
    "presence": true
  }'
```

### ESP32 Arduino 示例

```cpp
#include <WiFi.h>
#include <HTTPClient.h>

const char* SERVER_URL  = "http://192.168.1.100:3001/api/reports";
const char* DEVICE_TOKEN = "<设备Token>";
const char* DEVICE_ID    = "classroom-101";

void uploadReport(float light1Pct, float light2Pct,
                  int light1Adc, int light2Adc,
                  int aqi, float temp, bool presence) {
  HTTPClient http;
  http.begin(SERVER_URL);
  http.addHeader("Authorization", String("Bearer ") + DEVICE_TOKEN);
  http.addHeader("Content-Type", "application/json");

  String body = String("{") +
    "\"device_id\":\"" + DEVICE_ID + "\"," +
    "\"light1\":" + String(light1Pct, 1) + "," +
    "\"light2\":" + String(light2Pct, 1) + "," +
    "\"light1_adc\":" + light1Adc + "," +
    "\"light2_adc\":" + light2Adc + "," +
    "\"aqi\":" + aqi + "," +
    "\"temperature\":" + String(temp, 2) + "," +
    "\"presence\":" + (presence ? "true" : "false") +
    "}";

  int code = http.POST(body);
  Serial.println(code == 201 ? "上报成功" : "上报失败 HTTP " + String(code));
  http.end();
}
```

---

## 2. 查询接口（JWT 鉴权）

### 2.1 `GET /api/reports/latest`

获取最新一条上报。

| Query 参数 | 必填 | 说明 |
|------------|------|------|
| `device_id` | 否 | 指定设备，不传则返回全局最新 |

```json
{
  "ok": true,
  "data": {
    "device_id": "classroom-101",
    "light1": 73.5, "light2": 60.2,
    "light1_adc": 2048, "light2_adc": 1850,
    "aqi": 65, "temperature": 24.5, "presence": true,
    "reported_at": "2026-08-04T10:30:00.000Z",
    "received_at": "2026-08-04T10:30:00.512Z"
  }
}
```

> 无数据时 `data` 为 `null`。

### 2.2 `GET /api/reports/history`

分页查询历史上报，按 `reported_at` 倒序。

| Query 参数 | 默认 | 说明 |
|------------|------|------|
| `device_id` | — | 按设备筛选 |
| `start` / `end` | — | 时间范围（ISO 8601） |
| `page` | `1` | 页码 |
| `size` | `20` | 每页条数，最大 200 |

```json
{
  "ok": true,
  "data": { "total": 128, "page": 1, "size": 20, "items": [ /* ReportRow[] */ ] }
}
```

### 2.3 `GET /api/reports/stats`

聚合统计（图表用），按小时/天分桶。

| Query 参数 | 默认 | 说明 |
|------------|------|------|
| `metric` | — | `light1` / `light2` / `light1_adc` / `light2_adc` / `aqi` / `temperature` / `presence` |
| `granularity` | `hour` | `hour` 或 `day` |
| `device_id` | — | 按设备筛选 |
| `start` / `end` | — | 时间范围 |

```json
{
  "ok": true,
  "data": {
    "metric": "temperature",
    "points": [
      { "t": "2026-08-04T09:00:00.000Z", "avg": 24.3, "min": 23.1, "max": 25.6, "count": 12 }
    ]
  }
}
```

> `metric=presence` 时 `avg/min/max` 为有人占比/极值（0/1）。

---

## 3. 字段参考

| 字段 | 单位 | 范围 |
|------|------|------|
| `light1` / `light2` | % | 0–100 |
| `light1_adc` / `light2_adc` | ADC | 0–4095 |
| `aqi` | 指数 | 0–500（≤50 优，≤100 良，>100 污染） |
| `temperature` | ℃ | -40 ~ 85 |
| `presence` | — | true/false |

**错误格式**：`{ "ok": false, "error": "错误描述" }`。JWT 失效（401）时前端自动跳转登录。
