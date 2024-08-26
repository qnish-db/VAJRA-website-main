CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  pesu_id TEXT,
  password TEXT
);

CREATE TABLE counter (
  id SERIAL PRIMARY KEY,
  name TEXT,
  counter_value INTEGER
);