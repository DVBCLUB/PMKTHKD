# PMKTHKD

Phần mềm quản lý bán hàng, tồn kho, công nợ và sổ thu chi cho hộ kinh doanh tạp hóa.

## Kiến trúc

```text
React + Vite frontend
        │
        ├── IndexedDB cache/offline (giai đoạn tiếp theo)
        │
        ▼
Cloudflare Worker API
        │
        ▼
Cloudflare D1 database
```

Frontend hiện tại vẫn giữ giao diện và dữ liệu demo. Backend Cloudflare mới nằm trong thư mục [`backend`](./backend) và đã có:

- Đăng nhập, phiên làm việc và phân quyền nhân viên.
- Database cho sản phẩm, tồn kho, đơn hàng, đối tác và sổ thu chi.
- Chống trùng đơn và ghi dữ liệu theo transaction.
- Token an toàn cho Chrome Extension.
- Audit log, sync event và backup JSON.

## Chạy frontend

```bash
npm install
npm run dev
```

## Chạy backend

```bash
cd backend
npm install
cp .dev.vars.example .dev.vars
npm run db:migrate:local
npm run dev
```

Xem hướng dẫn cấu hình D1, bootstrap tài khoản và deploy tại [`backend/README.md`](./backend/README.md).

## Biến môi trường frontend

```env
VITE_API_URL=http://localhost:8787
```

Khi deploy, thay bằng URL Worker thật.
