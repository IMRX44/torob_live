-- Catalog imported from the Torob dataset (rebuilt by `pnpm ingest`).
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TABLE IF NOT EXISTS malls (
  id            text PRIMARY KEY,
  name          text NOT NULL,
  area          text,
  lat           double precision NOT NULL,
  lon           double precision NOT NULL,
  shop_count    int NOT NULL DEFAULT 0,
  floors        int[] NOT NULL DEFAULT '{}',
  top_categories text[] NOT NULL DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS shops (
  id              text PRIMARY KEY,
  name            text NOT NULL,
  name_is_real    boolean NOT NULL DEFAULT false,
  address         text NOT NULL,
  area            text,
  lat             double precision NOT NULL,
  lon             double precision NOT NULL,
  categories      text[] NOT NULL DEFAULT '{}',
  categories_norm text NOT NULL DEFAULT '',
  phone           text,
  instagram       text,
  website         text,
  fast_delivery   boolean,
  hours           jsonb NOT NULL,
  hours_known     boolean NOT NULL DEFAULT false,
  payments        jsonb NOT NULL DEFAULT '[]',
  has_installment boolean NOT NULL DEFAULT false,
  has_torobpay_in_person boolean NOT NULL DEFAULT false,
  mall_id         text REFERENCES malls(id),
  mall_name       text,
  floor           int,
  unit            text,
  offer_count     int NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS shops_geo ON shops (lat, lon);
CREATE INDEX IF NOT EXISTS shops_mall ON shops (mall_id);
CREATE INDEX IF NOT EXISTS shops_cat_trgm ON shops USING gin (categories_norm gin_trgm_ops);

CREATE TABLE IF NOT EXISTS products (
  id           text PRIMARY KEY,
  title        text NOT NULL,
  title_norm   text NOT NULL,
  brand        text,
  model        text,
  category     text NOT NULL,
  images       text[] NOT NULL DEFAULT '{}',
  specs        jsonb NOT NULL DEFAULT '[]',
  seller_count int NOT NULL DEFAULT 0,
  price_min    bigint,
  price_median bigint,
  price_max    bigint,
  last_change  timestamptz
);
CREATE INDEX IF NOT EXISTS products_title_trgm ON products USING gin (title_norm gin_trgm_ops);
CREATE INDEX IF NOT EXISTS products_category ON products (category);

CREATE TABLE IF NOT EXISTS offers (
  id               text PRIMARY KEY,
  product_id       text NOT NULL REFERENCES products(id),
  shop_id          text NOT NULL REFERENCES shops(id),
  seller_title     text NOT NULL,
  description      text,
  price            bigint,
  price_quality    text NOT NULL,
  price_changed_at timestamptz,
  warranty         jsonb
);
CREATE INDEX IF NOT EXISTS offers_product ON offers (product_id);
CREATE INDEX IF NOT EXISTS offers_shop ON offers (shop_id);

CREATE TABLE IF NOT EXISTS categories (
  name          text PRIMARY KEY,
  name_norm     text NOT NULL,
  product_count int NOT NULL,
  offer_count   int NOT NULL,
  shop_count    int NOT NULL
);
CREATE INDEX IF NOT EXISTS categories_trgm ON categories USING gin (name_norm gin_trgm_ops);

CREATE TABLE IF NOT EXISTS dataset_report (
  id      int PRIMARY KEY DEFAULT 1,
  report  jsonb NOT NULL,
  created timestamptz NOT NULL DEFAULT now()
);
