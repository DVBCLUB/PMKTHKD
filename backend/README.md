# PMKTHKD Backend — Cloudflare Workers + D1

Backend này thay thế Express server lưu dữ liệu trong RAM bằng một API có database thật, phân quyền và nhật ký kiểm toán. Toàn bộ thành phần có thể chạy trên gói Cloudflare Workers Free.

## Chức năng đã có

- Khởi tạo cửa hàng và tài khoản chủ cửa hàng bằng bootstrap token.
- Đăng nhập email/mật khẩu, PBKDF2-SHA256, khóa tạm sau nhiều lần nhập sai.
- Phiên đăng nhập có hạn dùng và có thể đăng xuất/thu hồi.
- Phân quyền: `owner`, `manager`, `accountant`, `cashier`, `viewer`.
- Quản lý sản phẩm, tồn kho, đối tác, sổ thu chi và nhân viên.
- Nhập đơn Shopee, TikTok, POS hoặc thủ công.
- Chống trùng đơn bằng `platform + order_sn` và `idempotency_key`.
- Trừ kho, ghi chuyển động kho và ghi doanh thu trong cùng D1 batch transaction.
- Token riêng cho Chrome Extension, có scope, ngày hết hạn và khả năng thu hồi.
- Nhật ký kiểm toán, sự kiện đồng bộ và xuất bản sao lưu JSON.
- CORS chỉ cho phép các frontend đã khai báo.

## 1. Cài đặt

```bash
cd backend
npm install
cp .dev.vars.example .dev.vars
```

Điền một chuỗi ngẫu nhiên dài vào `BOOTSTRAP_TOKEN` trong `.dev.vars`.

## 2. Tạo D1 database

```bash
npm run db:create
```

Cloudflare sẽ trả về `database_id`. Thay UUID giả trong `wrangler.jsonc` bằng UUID thật.

Áp dụng migration:

```bash
npm run db:migrate:local
npm run db:migrate:remote
```

## 3. Cấu hình frontend được phép gọi API

Trong `wrangler.jsonc`, thay:

```json
"ALLOWED_ORIGINS": "https://REPLACE-ME.pages.dev,http://localhost:5173"
```

bằng địa chỉ Cloudflare Pages thật. Có thể khai báo nhiều địa chỉ, phân cách bằng dấu phẩy.

Không đặt `*` khi vận hành thật.

## 4. Đặt secret trên Cloudflare

```bash
npx wrangler secret put BOOTSTRAP_TOKEN
```

Bootstrap token chỉ dùng để tạo tài khoản chủ đầu tiên. Sau khi khởi tạo xong, có thể đổi secret thành một chuỗi ngẫu nhiên mới để endpoint bootstrap không còn dùng lại được.

## 5. Chạy local

```bash
npm run dev
```

Kiểm tra:

```bash
curl http://localhost:8787/api/health
```

## 6. Tạo cửa hàng và tài khoản chủ

```bash
curl -X POST http://localhost:8787/api/auth/bootstrap \
  -H "Content-Type: application/json" \
  -H "X-Bootstrap-Token: YOUR_BOOTSTRAP_TOKEN" \
  -d '{
    "shopName": "Tạp hóa Trâm Anh",
    "displayName": "Chủ cửa hàng",
    "email": "owner@example.com",
    "password": "a-very-long-password"
  }'
```

Response trả về session token. Frontend có thể gửi token bằng:

```text
Authorization: Bearer pmk_sess_...
```

## 7. Deploy Worker

```bash
npm run typecheck
npm run deploy
```

Sau khi deploy, đặt ở frontend:

```env
VITE_API_URL=https://pmkthkd-api.<subdomain>.workers.dev
```

## 8. Token Chrome Extension

Đăng nhập với tài khoản `owner`, sau đó gọi:

```bash
curl -X POST https://YOUR-WORKER/api/integrations/tokens \
  -H "Authorization: Bearer pmk_sess_..." \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Chrome Extension máy quầy",
    "scopes": ["orders:import", "sync:read"]
  }'
```

Token `pmk_ext_...` chỉ xuất hiện một lần. Extension lưu token này và gửi qua `Authorization: Bearer`.

## API chính

| Method | Endpoint | Quyền |
|---|---|---|
| `GET` | `/api/health` | Công khai |
| `POST` | `/api/auth/bootstrap` | Bootstrap token |
| `POST` | `/api/auth/login` | Công khai |
| `POST` | `/api/auth/logout` | Đăng nhập |
| `GET` | `/api/me` | Đăng nhập |
| `GET` | `/api/dashboard` | Đăng nhập |
| `GET/POST` | `/api/products` | Đọc / manager |
| `PATCH` | `/api/products/:id` | Manager |
| `POST` | `/api/inventory/adjust` | Manager |
| `GET` | `/api/inventory/movements` | Đăng nhập |
| `POST` | `/api/orders/import` | User hoặc integration scope `orders:import` |
| `GET` | `/api/orders` | Đăng nhập |
| `GET` | `/api/orders/:id` | Đăng nhập |
| `GET/POST` | `/api/cash-transactions` | Đọc / cashier |
| `GET/POST` | `/api/partners` | Đọc / cashier |
| `GET/POST/PATCH` | `/api/users` | Manager / owner |
| `GET/POST/DELETE` | `/api/integrations/tokens` | Owner |
| `GET` | `/api/sync/events` | User hoặc integration scope `sync:read` |
| `GET` | `/api/audit-logs` | Manager |
| `GET` | `/api/backup` | Owner hoặc accountant |

## Nguyên tắc dữ liệu

- Giá tiền lưu bằng số nguyên VND, không dùng số thực.
- Số lượng kho dùng `REAL` để hỗ trợ kg, lít hoặc sản phẩm bán lẻ theo phần.
- Không sửa trực tiếp tồn kho bằng API sản phẩm. Mọi thay đổi phải đi qua inventory movement.
- Mỗi đơn chỉ được ghi một lần.
- Order, order items, inventory movements, product stock và cash transaction được commit hoặc rollback cùng nhau.
- Ảnh hóa đơn không lưu Base64 trong D1. Giai đoạn miễn phí hoàn toàn nên lưu file trên máy và sao lưu thủ công lên Google Drive.

## Việc frontend cần làm tiếp

`src/lib/apiClient.ts` đã cung cấp client gọi API. Bước tiếp theo là thay dần các `localStorage` trong `App.tsx` bằng:

1. Đọc dữ liệu từ API khi đăng nhập.
2. Cache dữ liệu trong IndexedDB để dùng offline.
3. Ghi thao tác offline vào outbox.
4. Đồng bộ outbox khi có mạng.
5. Dùng `/api/sync/events?cursor=...` để biết dữ liệu nào đã thay đổi.
