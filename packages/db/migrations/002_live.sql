-- Live data created by users and sellers (survives re-ingest).

CREATE TABLE IF NOT EXISTS app_sessions (
  id         text PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now(),
  state      jsonb NOT NULL DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS inquiries (
  id          text PRIMARY KEY,
  session_id  text NOT NULL,
  product_id  text,
  query_text  text,
  message     text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  timeout_sec int NOT NULL DEFAULT 90
);
CREATE INDEX IF NOT EXISTS inquiries_session ON inquiries (session_id, created_at DESC);

CREATE TABLE IF NOT EXISTS inquiry_targets (
  id            text PRIMARY KEY,
  inquiry_id    text NOT NULL REFERENCES inquiries(id) ON DELETE CASCADE,
  shop_id       text NOT NULL,
  offer_id      text,
  listed_price  bigint,
  status        text NOT NULL DEFAULT 'pending', -- pending|seen|available|price_changed|unavailable|alternative|timeout
  reply_price   bigint,
  reply_note    text,
  alt_product_id text,
  hold_until    timestamptz,
  open_until    text,
  seen_at       timestamptz,
  replied_at    timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS targets_shop ON inquiry_targets (shop_id, created_at DESC);
CREATE INDEX IF NOT EXISTS targets_inquiry ON inquiry_targets (inquiry_id);

-- A seller (or shopper on site) vouching for an offer's price/stock right now.
CREATE TABLE IF NOT EXISTS confirmations (
  id          bigserial PRIMARY KEY,
  shop_id     text NOT NULL,
  product_id  text NOT NULL,
  source      text NOT NULL, -- seller|crowd
  available   boolean NOT NULL,
  price       bigint,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS confirmations_lookup ON confirmations (product_id, shop_id, created_at DESC);

CREATE TABLE IF NOT EXISTS shop_overrides (
  shop_id     text PRIMARY KEY,
  today_close text,
  today_date  date,
  note        text,
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS crowd_reports (
  id         bigserial PRIMARY KEY,
  session_id text NOT NULL,
  shop_id    text NOT NULL,
  product_id text,
  kind       text NOT NULL, -- closed|unavailable|available|price
  price      bigint,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS crowd_shop ON crowd_reports (shop_id, created_at DESC);

CREATE TABLE IF NOT EXISTS trips (
  id         text PRIMARY KEY,
  session_id text NOT NULL,
  plan       jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS checklists (
  category   text PRIMARY KEY,
  items      jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
