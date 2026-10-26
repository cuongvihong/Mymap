CREATE TABLE dg_schema_version (version INTEGER NOT NULL);

CREATE TABLE dg_projects (
  id            INTEGER PRIMARY KEY,
  code          INTEGER NOT NULL UNIQUE,          -- hiển thị 4 chữ số, dùng đặt tên thư mục
  name          TEXT NOT NULL,
  name_norm     TEXT NOT NULL UNIQUE,
  folder        TEXT NOT NULL UNIQUE,             -- 'du-an/0003-moe-education-account'
  docs_root     TEXT,                             -- thư mục tài liệu FS, tuyệt đối
  viewport_json TEXT,                             -- {x,y,zoom} lần đóng gần nhất
  settings_json TEXT NOT NULL DEFAULT '{}',       -- mode một dây hay nhiều dây, ảnh khi Play
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL
);

CREATE TABLE dg_groups (
  id          INTEGER PRIMARY KEY,
  project_id  INTEGER NOT NULL REFERENCES dg_projects(id) ON DELETE CASCADE,
  key         TEXT NOT NULL,                      -- id theo BR-01, ví dụ 'R9'
  title       TEXT NOT NULL,
  fs_file     TEXT,                               -- tương đối so với docs_root
  collapsed   INTEGER NOT NULL DEFAULT 0,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  UNIQUE (project_id, key)
);

CREATE TABLE dg_nodes (
  id            INTEGER PRIMARY KEY,
  project_id    INTEGER NOT NULL REFERENCES dg_projects(id) ON DELETE CASCADE,
  key           TEXT NOT NULL,                    -- id theo BR-01, ví dụ 'F9.4'
  type          TEXT NOT NULL CHECK (type IN ('fnc','req','tech','ext','start','end','cond','note')),
  subtype       TEXT,                             -- tech: api|database|service|ui|queue|storage|job
                                                  -- start: user|schedule|api|event
                                                  -- end: ok|fail|warn ; note: màu
  code          TEXT NOT NULL,
  title         TEXT NOT NULL,
  body          TEXT NOT NULL DEFAULT '',
  fix_text      TEXT NOT NULL DEFAULT '',         -- Nơi sửa, chữ tự do
  chips_json    TEXT NOT NULL DEFAULT '[]',
  fs_file       TEXT,                             -- tương đối so với docs_root
  fs_section    TEXT,
  group_id      INTEGER REFERENCES dg_groups(id) ON DELETE SET NULL,
  x             REAL NOT NULL DEFAULT 0,
  y             REAL NOT NULL DEFAULT 0,
  has_layout    INTEGER NOT NULL DEFAULT 0,       -- 1 khi đã có tọa độ thật (BR-04)
  collapsed     INTEGER NOT NULL DEFAULT 0,
  study_item_id INTEGER,                          -- [TH] để trống ở MapApp, dùng khi gộp studyapp
  search_norm   TEXT NOT NULL DEFAULT '',         -- normalize(code, title, body, fix_text, chips)
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL,
  UNIQUE (project_id, key)
);

CREATE TABLE dg_images (
  id          INTEGER PRIMARY KEY,
  node_id     INTEGER NOT NULL REFERENCES dg_nodes(id) ON DELETE CASCADE,
  rel_path    TEXT NOT NULL,                      -- tương đối so với folder của dự án
  width       INTEGER NOT NULL,
  height      INTEGER NOT NULL,
  caption     TEXT NOT NULL DEFAULT '',
  sort_order  INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE dg_pins (
  id          INTEGER PRIMARY KEY,
  image_id    INTEGER NOT NULL REFERENCES dg_images(id) ON DELETE CASCADE,
  x_pct       REAL NOT NULL CHECK (x_pct BETWEEN 0 AND 100),
  y_pct       REAL NOT NULL CHECK (y_pct BETWEEN 0 AND 100),
  note        TEXT NOT NULL DEFAULT '',
  sort_order  INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE dg_links (
  id          INTEGER PRIMARY KEY,
  project_id  INTEGER NOT NULL REFERENCES dg_projects(id) ON DELETE CASCADE,
  key         TEXT NOT NULL,
  from_node   INTEGER NOT NULL REFERENCES dg_nodes(id) ON DELETE CASCADE,
  to_node     INTEGER NOT NULL REFERENCES dg_nodes(id) ON DELETE CASCADE,
  via         TEXT NOT NULL CHECK (via IN
               ('impl','rest','webhook','db','ui','call','redirect','job','event','queue','file')),
  label       TEXT NOT NULL DEFAULT '',
  note        TEXT NOT NULL DEFAULT '',
  sort_order  INTEGER NOT NULL DEFAULT 0,
  CHECK (from_node <> to_node),
  UNIQUE (project_id, key)
);
CREATE INDEX ix_links_pair ON dg_links(project_id, from_node, to_node);

CREATE TABLE dg_scenarios (
  id           INTEGER PRIMARY KEY,
  project_id   INTEGER NOT NULL REFERENCES dg_projects(id) ON DELETE CASCADE,
  key          TEXT NOT NULL,                     -- ví dụ 'N-05'
  type         TEXT NOT NULL CHECK (type IN ('pos','neg','alt','edge')),
  title        TEXT NOT NULL,
  parent_id    INTEGER REFERENCES dg_scenarios(id) ON DELETE SET NULL,
  fork_node_id INTEGER REFERENCES dg_nodes(id) ON DELETE SET NULL,
  sort_order   INTEGER NOT NULL DEFAULT 0,
  UNIQUE (project_id, key)
);

CREATE TABLE dg_steps (
  id           INTEGER PRIMARY KEY,
  scenario_id  INTEGER NOT NULL REFERENCES dg_scenarios(id) ON DELETE CASCADE,
  idx          INTEGER NOT NULL,
  node_id      INTEGER NOT NULL REFERENCES dg_nodes(id) ON DELETE CASCADE,
  note         TEXT NOT NULL DEFAULT '',
  UNIQUE (scenario_id, idx)
);

INSERT INTO dg_schema_version(version) VALUES (1);
