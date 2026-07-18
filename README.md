# PMKTHKD

Phần mềm quản lý bán hàng, tồn kho, công nợ và sổ thu chi cho hộ kinh doanh tạp hóa.

## Kiến trúc miễn phí

```text
Cloudflare Pages
React + Vite + PWA
        │
        ├── IndexedDB cache + outbox khi mất mạng
        ├── Tự nhập dữ liệu localStorage cũ lần đầu
        └── Đồng bộ có version và xử lý xung đột
                │
                ▼
Cloudflare Worker API
        │
        ├── Auth + phân quyền + audit log
        ├── API sản phẩm, kho, đơn hàng, thu chi
        └── Snapshot tương thích + 30 điểm khôi phục
                │
                ▼
Cloudflare D1
```

Frontend hiện có:

- Màn hình đăng nhập và thiết lập chủ cửa hàng lần đầu.
- Cấu hình Worker URL ngay trên giao diện, không phải build lại chỉ để đổi URL.
- Tự chuyển dữ liệu cũ từ `localStorage` lên D1.
- IndexedDB cache và hàng đợi offline.
- Đồng bộ nền sau 1,5 giây, kéo dữ liệu mới mỗi 60 giây hoặc khi quay lại tab.
- Phát hiện xung đột khi hai máy cùng sửa và cho chọn bản giữ lại.
- PWA cài lên máy tính/điện thoại, mở được khi mất mạng.
- Tạo checkpoint D1 và tải backup JSON từ giao diện.

Backend trong [`backend`](./backend) có:

- Đăng nhập, phiên làm việc và phân quyền nhân viên.
- Database chuẩn hóa cho sản phẩm, tồn kho, đơn hàng, đối tác và sổ thu chi.
- Chống trùng đơn, audit log và sync event.
- Token riêng cho Chrome Extension.
- Snapshot tương thích để giao diện cũ hoạt động ngay trong lúc chuyển dần sang API chuẩn hóa.
- Tối đa 30 phiên bản gần nhất để khôi phục khi ghi nhầm hoặc xung đột.

## Chạy frontend

```bash
npm install
npm run dev
```

Mở trang và nhập địa chỉ Worker. Có thể đặt sẵn bằng:

```env
VITE_API_URL=http://localhost:8787
```

## Chạy backend

```bash
cd backend
npm install
cp .dev.vars.example .dev.vars
npm run db:migrate:local
npm run dev
```

## Kiểm tra

```bash
npm run lint
npm run build
npm run backend:typecheck
```

## Deploy

Xem hướng dẫn đầy đủ tại [`docs/CLOUDFLARE_DEPLOY.md`](./docs/CLOUDFLARE_DEPLOY.md).

Không merge hoặc deploy trước khi đã thay `database_id`, `ALLOWED_ORIGINS` và đặt `BOOTSTRAP_TOKEN`.
