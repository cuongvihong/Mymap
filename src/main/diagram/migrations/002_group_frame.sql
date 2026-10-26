-- Khung của nhóm chưa có khối nào (FR-VC-05, vòng canvas, ô Nhóm FS). Khi nhóm đã có khối thì
-- khung tính từ các khối và bốn cột này không được dùng.
ALTER TABLE dg_groups ADD COLUMN frame_x REAL;
ALTER TABLE dg_groups ADD COLUMN frame_y REAL;
ALTER TABLE dg_groups ADD COLUMN frame_w REAL;
ALTER TABLE dg_groups ADD COLUMN frame_h REAL;
