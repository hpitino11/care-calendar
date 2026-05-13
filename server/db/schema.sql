CREATE TABLE IF NOT EXISTS caregivers (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(100),
  phone VARCHAR(20)
);

CREATE TABLE IF NOT EXISTS clients (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(100),
  phone VARCHAR(20)
);

CREATE TABLE IF NOT EXISTS visits (
  id SERIAL PRIMARY KEY,
  caregiver_id INTEGER REFERENCES caregivers(id) ON DELETE SET NULL,
  client_id INTEGER REFERENCES clients(id) ON DELETE SET NULL,
  visit_date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  status VARCHAR(20) DEFAULT 'scheduled',
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);
