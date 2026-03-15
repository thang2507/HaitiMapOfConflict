# HaitiMapOfConflict

Ứng dụng web nội bộ dùng Flask + Leaflet để hiển thị bản đồ xung đột tại Haiti, chồng thêm các lớp marker vận hành, hỗ trợ vẽ trực tiếp trên bản đồ, import dữ liệu từ Excel, lưu thay đổi xuống file và theo dõi lịch sử thao tác qua audit log.

## 1. Ứng dụng hoạt động như thế nào

- Backend là Flask, khởi tạo tại `app.py` và `backend/app_factory.py`.
- Frontend là HTML/CSS/JavaScript thuần, được phục vụ trực tiếp từ thư mục `frontend/`.
- Toàn bộ dữ liệu chính được lưu bằng file trong thư mục `data/`, không dùng database.
- Khi người dùng chỉnh sửa dữ liệu, app sẽ:
  1. kiểm tra quyền;
  2. kiểm tra phiên bản dữ liệu hiện tại để tránh ghi đè thay đổi của người khác;
  3. tạo bản backup;
  4. ghi file mới;
  5. lưu audit log vào `data/audit_log.jsonl`.

## 2. Chức năng chính

- Hiển thị bản đồ nền `Street Map` hoặc `Vệ tinh`.
- Tải lớp xung đột từ `data/Haiti_conflict_map.geojson`.
- Tải các lớp marker:
  - `Site`
  - `Police`
  - `Bandit`
  - `Showroom`
  - `HQ`
- Bật/tắt riêng icon và label cho từng lớp.
- Chỉnh mức hiển thị trong suốt của lớp xung đột.
- Hiện/ẩn chú thích bản đồ.
- Vẽ trực tiếp lên bản đồ bằng Leaflet Draw:
  - polygon
  - polyline
  - rectangle
  - circle
  - marker
- Gắn text cho đối tượng vừa vẽ.
- Chỉnh sửa marker vận hành:
  - bật/tắt `Edit Mode`
  - thêm mới Police/Bandit/Showroom
  - kéo thả marker
  - đổi tên / xóa bằng chuột phải
  - undo / redo
  - autosave mỗi 5 giây nếu có thay đổi
- Import dữ liệu từ file `.xlsx` cho:
  - conflict
  - site
  - police
  - bandit
  - showroom
  - HQ
- Backup toàn bộ file dữ liệu trong `data/` dưới dạng `.zip`.
- Quản lý người dùng và xem log thay đổi trên giao diện.

## 3. Phân quyền

App dùng session cookie và có 3 mức quyền:

- `guest`: chỉ xem dữ liệu.
- `editor`: được sửa conflict, marker, drawings, tải backup, đổi mật khẩu, xem audit log.
- `admin`: có toàn quyền của `editor` và thêm quyền import dữ liệu, tạo user editor, xóa user editor, reset mật khẩu user editor.

Lưu ý:

- Session hiện tại sẽ bị vô hiệu nếu server restart, vì app tạo `SESSION_RUNTIME_TOKEN` mới mỗi lần khởi động.
- Frontend ẩn/khóa các nút theo role, backend vẫn kiểm tra lại quyền ở từng API.

## 4. Cấu trúc dữ liệu chính

### File dữ liệu đang dùng

- `data/Haiti_conflict_map.geojson`: bản đồ xung đột đang hiển thị.
- `data/conflict_template.xlsx`: nguồn Excel dùng để cập nhật conflict.
- `data/drawings.geojson`: các hình vẽ trực tiếp trên bản đồ.
- `data/SitePosition.xlsx`, `data/SitePosition.json`
- `data/PolicePosition.xlsx`, `data/PolicePosition.json`
- `data/BanditPosition.xlsx`, `data/BanditPosition.json`
- `data/ShowroomPosition.xlsx`, `data/ShowroomPosition.json`
- `data/HQ_Position.xlsx`, `data/HQ_Position.json`
- `data/users.json`: tài khoản và role.
- `data/audit_log.jsonl`: log thay đổi theo từng dòng JSON.

### Backup

- Conflict backup: `data/backup/conflict_template/`
- Drawings backup: `data/backup/draw/`
- Marker backup theo loại:
  - `data/backup/police/`
  - `data/backup/bandit/`
  - `data/backup/showroom/`

### Định dạng đầu vào quan trọng

File conflict `.xlsx` phải có các cột:

- `region_name`
- `conflict_level`

File marker `.xlsx` phải có:

- Police: `PoliceName`, `Longitude`, `Latitude`
- Bandit: `BanditName`, `Longitude`, `Latitude`
- Showroom: `ShowroomName`, `Longitude`, `Latitude`
- HQ: `HQName`, `Longitude`, `Latitude`
- Site: `SiteName`, `Longitude`, `Latitude`

Riêng Site có thể có thêm cột:

- `MainNode`

## 5. Cài đặt và chạy

Yêu cầu:

- Python 3.14 theo môi trường hiện tại của repo
- Các package trong `requirements.txt`

Cài thư viện:

```powershell
pip install -r requirements.txt
```

Chạy ứng dụng:

```powershell
python app.py
```

Mặc định app chạy bằng Flask dev server. Có thể bật debug bằng biến môi trường:

```powershell
$env:FLASK_DEBUG="true"
python app.py
```

Sau khi chạy, mở trình duyệt tại địa chỉ Flask đang in ra terminal, thường là `http://127.0.0.1:5000/`.

## 6. Tài khoản mặc định

Theo code trong `backend/services/user_service.py`, mật khẩu mặc định khi tạo user mới là:

```text
Natcom@123
```

Repo hiện có sẵn:

- 1 tài khoản `admin`
- 1 tài khoản `guest`
- nhiều tài khoản `editor` trong `data/users.json`

Vì `users.json` đang chứa cả bản ghi có `password_hash` và bản ghi có `password` thuần, khi app đọc file nó sẽ tự chuẩn hóa và hash lại lúc ghi lưu lần tiếp theo.

## 7. Hướng dẫn sử dụng giao diện

### Xem bản đồ

1. Chạy app và mở trang chủ `/`.
2. Dùng bộ chọn lớp ở góc bản đồ để đổi giữa `Street Map` và `Vệ tinh`.
3. Dùng panel bên trái để:
   - bật/tắt chú thích;
   - chỉnh độ mờ lớp conflict;
   - bật/tắt icon và label của từng lớp dữ liệu.

### Đăng nhập

1. Nhấn `Login`.
2. Nhập username và password.
3. Sau khi đăng nhập:
   - `editor` sẽ thấy nhóm chức năng chỉnh sửa dữ liệu;
   - `admin` sẽ thấy thêm nhóm import và quản lý user.

### Sửa conflict level

1. Đăng nhập bằng `editor` hoặc `admin`.
2. Chuột phải vào một vùng trên bản đồ conflict.
3. Chọn mức `level0`, `level1`, `level2` hoặc `empty`.
4. App lưu ngay thay đổi cho vùng đó.
5. Có thể dùng nút `Lưu Conflict Data` để ghi lại toàn bộ trạng thái hiện tại.

Lưu ý:

- App dùng header `X-Data-Version` để tránh ghi đè nếu dữ liệu đã bị người khác sửa trước đó.
- Nếu có xung đột phiên bản, frontend sẽ báo lỗi và tải lại dữ liệu mới từ server.

### Import dữ liệu từ Excel

1. Đăng nhập bằng `admin`.
2. Mở `Menu import`.
3. Chọn file `.xlsx` tương ứng.
4. App sẽ lưu file vào `data/`, chuyển đổi sang `.json` hoặc cập nhật `.geojson`, rồi reload lớp dữ liệu nếu cần.

Chi tiết:

- Import conflict:
  - lưu vào `data/conflict_template.xlsx`
  - backup file cũ
  - cập nhật `data/Haiti_conflict_map.geojson`
- Import site:
  - lưu `SitePosition.xlsx`
  - sinh `SitePosition.json`
- Import police/bandit/showroom/HQ:
  - lưu `.xlsx`
  - sinh `.json`

### Chỉnh sửa marker vận hành

1. Đăng nhập bằng `editor` hoặc `admin`.
2. Bật `Edit Mode`.
3. Nhấn `+ Add Police`, `+ Add Bandit` hoặc `+ Add Showroom`.
4. Click lên bản đồ để tạo marker mới.
5. Nhập tên marker trong popup.
6. Có thể kéo thả marker để đổi vị trí.
7. Chuột phải lên marker khi đang ở edit mode để sửa tên hoặc xóa.
8. Nhấn `Save Marker to File` để lưu ngay.

Lưu ý:

- App autosave mỗi 5 giây nếu có thay đổi và chưa lưu.
- Khi lưu marker, app đồng thời ghi lại cả file `.json` và `.xlsx`.
- Marker hiện chỉ hỗ trợ chỉnh sửa trực tiếp cho `police`, `bandit`, `showroom`.

### Vẽ trực tiếp lên bản đồ

1. Đăng nhập bằng `editor` hoặc `admin`.
2. Bật checkbox `Draw` phần tool.
3. Chọn màu vẽ.
4. Dùng thanh công cụ Leaflet Draw để vẽ.
5. Sau khi vẽ xong, app hỏi text chú thích.
6. Mỗi lần tạo, sửa hoặc xóa hình, app sẽ lưu vào `data/drawings.geojson`.

### Backup dữ liệu

1. Đăng nhập bằng `editor` hoặc `admin`.
2. Nhấn `BackupDB`.
3. App tải xuống một file `.zip` chứa toàn bộ các file trực tiếp nằm trong `data/`.

### Quản lý tài khoản

`editor`:

- đổi mật khẩu của chính mình;
- xem `logfile`.

`admin`:

- tạo user editor mới;
- xóa user editor;
- đặt lại mật khẩu user editor;
- không được tự xóa chính mình;
- chỉ quản lý được user có role `editor`.

## 8. API chính

- `GET /`:
  - trả về giao diện web
- `GET /Haiti_conflict_map.geojson`:
  - trả về bản đồ conflict và header `X-Data-Version`
- `POST /upload_conflict`:
  - admin import file conflict `.xlsx`
- `POST /save_conflict_data`:
  - editor lưu conflict level
- `GET /load_drawings`
- `POST /save_drawings`
- `GET /load_markers?type=police|bandit|showroom`
- `POST /save_markers?type=police|bandit|showroom`
- `POST /upload_site`
- `POST /upload_police`
- `POST /upload_bandit`
- `POST /upload_showroom`
- `POST /upload_hq`
- `GET /backup_data`
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/auth/me`
- `PUT /api/auth/password`
- `GET /api/audit-log`
- `GET /api/users`
- `POST /api/users`
- `DELETE /api/users/<username>`
- `PUT /api/users/<username>/password`

## 9. Kiểm thử

Chạy toàn bộ self-test:

```powershell
python run_selftest.py
```

Test hiện bao phủ các luồng chính:

- phục vụ frontend
- đăng nhập / đăng xuất / đổi mật khẩu
- phân quyền guest/editor/admin
- import conflict và marker
- lưu conflict / marker / drawings
- backup dữ liệu
- quản lý user
- audit log
- contract frontend

## 10. Ghi chú vận hành

- App không dùng database, nên cần sao lưu thư mục `data/` định kỳ.
- Dữ liệu conflict và marker có cơ chế chống ghi đè bằng version header, nhưng drawings thì không có version check.
- Nếu restart app, toàn bộ session đăng nhập cũ sẽ hết hiệu lực.
- Một số thư viện frontend được tải từ CDN:
  - Leaflet
  - Leaflet Draw
  - Leaflet Arrowheads
- Nút redirect `/login` có xuất hiện trong helper frontend khi gặp `401`, nhưng hiện app thực tế đăng nhập bằng modal trên trang chính.

## 11. Cấu trúc thư mục

```text
.
|-- app.py
|-- backend/
|   |-- app_factory.py
|   |-- auth.py
|   |-- config.py
|   |-- routes/
|   |-- services/
|   `-- utils/
|-- frontend/
|   |-- index.html
|   |-- css/
|   |-- html/
|   |-- images/
|   `-- scripts/
|-- data/
|   |-- *.json / *.geojson / *.xlsx
|   |-- users.json
|   |-- audit_log.jsonl
|   `-- backup/
|-- tests/
`-- run_selftest.py
```

## 12. Tóm tắt nhanh cho người mới

- Chạy `python app.py`
- Mở web tại `http://127.0.0.1:5000/`
- `guest` chỉ xem
- `editor` được sửa dữ liệu
- `admin` được import và quản lý user
- Mọi dữ liệu đều nằm trong `data/`
- Mọi thay đổi quan trọng đều có backup và audit log
