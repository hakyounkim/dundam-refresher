-- 모험단 (서버 단위로 고유)
CREATE TABLE IF NOT EXISTS adventures (
  adventure_name TEXT NOT NULL,
  server_id      TEXT NOT NULL,
  last_sync_at   TIMESTAMPTZ,
  PRIMARY KEY (adventure_name, server_id)
);

-- 캐릭터
CREATE TABLE IF NOT EXISTS characters (
  character_id     TEXT PRIMARY KEY,
  adventure_name   TEXT NOT NULL,
  server_id        TEXT NOT NULL,
  character_name   TEXT NOT NULL,
  job_grow_name    TEXT,
  fame             INT,
  last_timeline_at TIMESTAMPTZ,
  FOREIGN KEY (adventure_name, server_id)
    REFERENCES adventures(adventure_name, server_id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_characters_adventure
  ON characters (adventure_name, server_id);

-- 타임라인 이벤트 (서약/결정 + 향후 115제 장비까지 일반화)
CREATE TABLE IF NOT EXISTS timeline_events (
  id            BIGSERIAL PRIMARY KEY,
  character_id  TEXT NOT NULL REFERENCES characters(character_id) ON DELETE CASCADE,
  occurred_at   TIMESTAMPTZ NOT NULL,
  event_code    INT NOT NULL,          -- 550/551/552/554/557 등
  event_name    TEXT NOT NULL,
  item_id       TEXT NOT NULL,
  item_name     TEXT NOT NULL,
  item_rarity   TEXT NOT NULL,         -- '태초' | '에픽' | ...
  item_category TEXT NOT NULL,         -- 'pact' | 'soul' | 'armor-115' ...
  channel_no    INT,
  channel_name  TEXT,
  dungeon_name  TEXT,
  mist_gear     BOOLEAN DEFAULT FALSE,
  raw           JSONB NOT NULL,
  UNIQUE (character_id, occurred_at, event_code, item_id)
);
CREATE INDEX IF NOT EXISTS idx_events_char_date
  ON timeline_events (character_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_events_category
  ON timeline_events (item_category, item_rarity, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_events_channel
  ON timeline_events (channel_name, occurred_at DESC);

-- 동기화 로그
CREATE TABLE IF NOT EXISTS sync_logs (
  id             BIGSERIAL PRIMARY KEY,
  adventure_name TEXT,
  server_id      TEXT,
  character_id   TEXT,
  started_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at       TIMESTAMPTZ,
  from_date      TIMESTAMPTZ,
  to_date        TIMESTAMPTZ,
  event_count    INT DEFAULT 0,
  status         TEXT NOT NULL,        -- 'ok' | 'error' | 'partial'
  error_message  TEXT
);
