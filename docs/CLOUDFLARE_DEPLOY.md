# Deploy PMKTHKD lên Cloudflare Free

## 1. Chuẩn bị

Cần có:

- Tài khoản Cloudflare Free.
- Node.js 22 hoặc mới hơn.
- Repo GitHub đã merge nhánh triển khai.
- Wrangler đăng nhập đúng tài khoản Cloudflare.

```bash
npx wrangler login
```

## 2. Tạo D1

```bash
cd backend
npx wrangler d1 create pmkthkd
```

Sao chép `database_id` trả về và thay giá trị giả trong `backend/wrangler.jsonc`.

## 3. Cấu hình Worker

Trong `backend/wrangler.jsonc`:

- `ALLOWED_ORIGINS`: URL Pages thật và `http://localhost:5173`.
- `MAX_STATE_BYTES`: mặc định 2.000.000 byte để tránh lưu ảnh Base64 quá lớn.
- `database_id`: ID D1 thật.

Tạo bootstrap token dài và ngẫu nhiên:

```bash
npx wrangler secret put BOOTSTRAP_TOKEN
```

Token này chỉ dùng để tạo tài khoản chủ đầu tiên. Không commit token vào GitHub.

## 4. Chạy migration và deploy Worker

```bash
npm install
npm run typecheck
npm run db:migrate:remote
npm run deploy
```

Ghi lại URL dạng:

```text
https://pmkthkd-api.<ten-tai-khoan>.workers.dev
```

Kiểm tra:

```bash
curl https://pmkthkd-api.<ten-tai-khoan>.workers.dev/api/health
```

## 5. Tạo Cloudflare Pages

Trong Cloudflare Dashboard:

1. Workers & Pages → Create → Pages → Connect to Git.
2. Chọn repo `DVBCLUB/PMKTHKD`.
3. Production branch: `main`.
4. Build command: `npm run build`.
5. Build output directory: `dist`.
6. Biến môi trường tùy chọn: `VITE_API_URL=<Worker URL>`.

Ứng dụng vẫn cho nhập Worker URL ở màn hình đăng nhập, nên `VITE_API_URL` không bắt buộc.

Sau khi Pages có URL thật, cập nhật `ALLOWED_ORIGINS` trong Worker rồi deploy lại.

## 6. Thiết lập cửa hàng lần đầu

Mở Pages URL, chọn **Thiết lập lần đầu**, nhập:

- Worker URL.
- Tên cửa hàng.
- Tên chủ cửa hàng.
- Email.
- Mật khẩu ít nhất 10 ký tự.
- Bootstrap token đã đặt ở bước 3.

Endpoint bootstrap tự khóa sau khi đã có người dùng đầu tiên.

## 7. Chuyển dữ liệu cũ

Nếu trình duyệt đang có dữ liệu PMKTHKD trong `localStorage`, lần đăng nhập đầu tiên sẽ tự:

1. Đọc sản phẩm, đơn hàng, thu chi, đối tác và nhập xuất kho cũ.
2. Lưu một bản vào IndexedDB.
3. Đẩy lên D1 dưới dạng snapshot tương thích.
4. Hiển thị trạng thái đồng bộ ở góc phải dưới.

Trước khi chuyển, nên tải một bản backup từ phiên bản cũ nếu dữ liệu quan trọng.

## 8. Chế độ offline và xung đột

- Mất mạng: thay đổi được ghi vào IndexedDB và chờ đồng bộ.
- Có mạng lại: outbox tự đẩy lên Worker.
- Hai máy cùng sửa: hệ thống dừng ghi đè và yêu cầu chọn dữ liệu máy chủ hoặc dữ liệu máy hiện tại.
- Mỗi lần cập nhật thành công, phiên bản cũ được lưu vào lịch sử; giữ tối đa 30 bản.

## 9. Không phát sinh tiền ngoài ý muốn

- Dùng Workers Free, Pages Free và D1 Free.
- Không bật Workers Paid.
- Không đăng ký R2 ở giai đoạn này.
- Không lưu ảnh hóa đơn Base64 lớn trong snapshot; đưa ảnh sang Google Drive và chỉ lưu đường dẫn/tham chiếu.
- Theo dõi giới hạn trong Cloudflare Dashboard.

## 10. Deploy bằng GitHub Actions (tùy chọn)

Workflow `.github/workflows/cloudflare-deploy.yml` chỉ chạy thủ công. Cần tạo GitHub Secrets:

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`

Và GitHub Variables:

- `CLOUDFLARE_PAGES_PROJECT` — ví dụ `pmkthkd-web`
- `VITE_API_URL` — URL Worker

Chỉ chạy workflow sau khi D1 và Pages project đã tồn tại.
