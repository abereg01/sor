-- 009_node_metadata_and_data_domains
-- Adds structured tables/enums for scalable node metadata + typed, hierarchical data domains for edge flows.

-- Ensure gen_random_uuid() exists
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- -----------------------------
-- 1) Enums for constrained fields
-- -----------------------------
DO $$ BEGIN
  CREATE TYPE supplier_type AS ENUM ('intern', 'saas', 'paas');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE owning_department AS ENUM ('el', 'varme', 'ekonomi', 'digit', 'vatten', 'stab', 'marknad');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE business_criticality AS ENUM ('low', 'medium', 'high');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE information_class AS ENUM ('intern', 'begransad', 'skyddad', 'oppen', 'konfidentiell');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE flow_direction AS ENUM ('fran', 'till', 'bidirectional');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- -----------------------------
-- 2) Reusable parties: suppliers + owners
-- -----------------------------
CREATE TABLE IF NOT EXISTS suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT suppliers_name_unique UNIQUE (name)
);

CREATE TABLE IF NOT EXISTS owners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT owners_name_unique UNIQUE (name)
);

-- -----------------------------
-- 3) Node structured metadata (scales better than one giant json blob)
-- -----------------------------
-- Supplier context (multi supplier types + supplier parties)
CREATE TABLE IF NOT EXISTS node_suppliers (
  node_id UUID NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
  supplier_id UUID NOT NULL REFERENCES suppliers(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (node_id, supplier_id)
);

-- Multi-select "Typ av leverantor" per node
CREATE TABLE IF NOT EXISTS node_supplier_types (
  node_id UUID NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
  supplier_type supplier_type NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (node_id, supplier_type)
);

-- Owning context department per node
ALTER TABLE nodes
  ADD COLUMN IF NOT EXISTS owning_department owning_department NULL;

-- Owners (many-to-many; can be reused across systems)
CREATE TABLE IF NOT EXISTS node_owners (
  node_id UUID NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL REFERENCES owners(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (node_id, owner_id)
);

-- Programvara block (one-to-one; optional)
CREATE TABLE IF NOT EXISTS node_software (
  node_id UUID PRIMARY KEY REFERENCES nodes(id) ON DELETE CASCADE,
  software_name TEXT NULL,
  purpose TEXT NULL,
  description TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Risk/juridik/klassning (one-to-one; optional)
CREATE TABLE IF NOT EXISTS node_risk (
  node_id UUID PRIMARY KEY REFERENCES nodes(id) ON DELETE CASCADE,

  legal_requirements BOOLEAN NULL,
  financial_value BOOLEAN NULL,
  pii BOOLEAN NULL,

  business_criticality business_criticality NULL,
  information_class information_class NULL,

  -- 0..5 in 0.5 steps
  criticality_score NUMERIC(2,1) NULL,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT node_risk_criticality_score_range CHECK (
    criticality_score IS NULL OR (criticality_score >= 0 AND criticality_score <= 5)
  ),
  CONSTRAINT node_risk_criticality_score_step CHECK (
    criticality_score IS NULL OR (criticality_score * 2 = floor(criticality_score * 2))
  )
);

CREATE INDEX IF NOT EXISTS idx_suppliers_name ON suppliers (name);
CREATE INDEX IF NOT EXISTS idx_owners_name ON owners (name);
CREATE INDEX IF NOT EXISTS idx_nodes_owning_department ON nodes (owning_department);

-- -----------------------------
-- 4) Typed, hierarchical data domains (for kopplingar)
-- -----------------------------
CREATE TABLE IF NOT EXISTS data_domains (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  parent_id UUID NULL REFERENCES data_domains(id) ON DELETE CASCADE,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT data_domains_unique_sibling_name UNIQUE (parent_id, name)
);

CREATE INDEX IF NOT EXISTS idx_data_domains_parent_id ON data_domains (parent_id);
CREATE INDEX IF NOT EXISTS idx_data_domains_name ON data_domains (name);

-- Edge flow -> selected domains
-- (Edge is the koppling. Direction semantics are explicit.)
CREATE TABLE IF NOT EXISTS edge_typed_flows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  edge_id UUID NOT NULL REFERENCES edges(id) ON DELETE CASCADE,
  direction flow_direction NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT edge_typed_flows_unique_edge_direction UNIQUE (edge_id, direction)
);

CREATE INDEX IF NOT EXISTS idx_edge_typed_flows_edge_id ON edge_typed_flows (edge_id);

CREATE TABLE IF NOT EXISTS edge_typed_flow_domains (
  flow_id UUID NOT NULL REFERENCES edge_typed_flows(id) ON DELETE CASCADE,
  domain_id UUID NOT NULL REFERENCES data_domains(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (flow_id, domain_id)
);

CREATE INDEX IF NOT EXISTS idx_edge_typed_flow_domains_domain_id ON edge_typed_flow_domains (domain_id);

-- -----------------------------
-- 5) Seed KEAB data domain hierarchy
-- -----------------------------
-- We insert with stable lookups by (parent_id, name) to keep it idempotent.

-- Top-level categories
WITH top AS (
  SELECT * FROM (VALUES
    ('Masterdata', 10),
    ('Transaktionsdata', 20),
    ('Referensdata', 30),
    ('Sensor- och IoT-data', 40),
    ('Dokumentdata', 50),
    ('Kommunikationsdata', 60),
    ('Loggdata', 70)
  ) AS v(name, sort_order)
)
INSERT INTO data_domains (name, parent_id, sort_order)
SELECT t.name, NULL, t.sort_order
FROM top t
ON CONFLICT (parent_id, name) DO UPDATE
SET sort_order = EXCLUDED.sort_order;

-- Helper: fetch id by name under a parent
-- Masterdata children
WITH master AS (
  SELECT id FROM data_domains WHERE parent_id IS NULL AND name = 'Masterdata'
)
INSERT INTO data_domains (name, parent_id, sort_order)
SELECT v.name, master.id, v.sort_order
FROM master
CROSS JOIN (VALUES
  ('Kunddata', 10),
  ('Anlaggningsdata', 20),
  ('Produktdata', 30),
  ('Personaldata', 40)
) AS v(name, sort_order)
ON CONFLICT (parent_id, name) DO UPDATE
SET sort_order = EXCLUDED.sort_order;

-- Kunddata leafs
WITH p AS (
  SELECT c.id AS parent_id
  FROM data_domains c
  JOIN data_domains t ON t.id = c.parent_id
  WHERE t.name = 'Masterdata' AND c.name = 'Kunddata'
)
INSERT INTO data_domains (name, parent_id, sort_order)
SELECT v.name, p.parent_id, v.sort_order
FROM p
CROSS JOIN (VALUES
  ('Namn', 10),
  ('Adress', 20),
  ('Kontaktuppgifter', 30),
  ('Kundnummer', 40)
) AS v(name, sort_order)
ON CONFLICT (parent_id, name) DO UPDATE
SET sort_order = EXCLUDED.sort_order;

-- Anlaggningsdata leafs
WITH p AS (
  SELECT c.id AS parent_id
  FROM data_domains c
  JOIN data_domains t ON t.id = c.parent_id
  WHERE t.name = 'Masterdata' AND c.name = 'Anlaggningsdata'
)
INSERT INTO data_domains (name, parent_id, sort_order)
SELECT v.name, p.parent_id, v.sort_order
FROM p
CROSS JOIN (VALUES
  ('Anlaggnings-ID', 10),
  ('Geografisk position', 20),
  ('Typ (El, Vatten, Marknad, Varme)', 30)
) AS v(name, sort_order)
ON CONFLICT (parent_id, name) DO UPDATE
SET sort_order = EXCLUDED.sort_order;

-- Produktdata leafs
WITH p AS (
  SELECT c.id AS parent_id
  FROM data_domains c
  JOIN data_domains t ON t.id = c.parent_id
  WHERE t.name = 'Masterdata' AND c.name = 'Produktdata'
)
INSERT INTO data_domains (name, parent_id, sort_order)
SELECT v.name, p.parent_id, v.sort_order
FROM p
CROSS JOIN (VALUES
  ('Tariff', 10),
  ('Abonnemangstyp', 20),
  ('Matarstorlek', 30)
) AS v(name, sort_order)
ON CONFLICT (parent_id, name) DO UPDATE
SET sort_order = EXCLUDED.sort_order;

-- Personaldata branches
WITH personal AS (
  SELECT c.id AS parent_id
  FROM data_domains c
  JOIN data_domains t ON t.id = c.parent_id
  WHERE t.name = 'Masterdata' AND c.name = 'Personaldata'
)
INSERT INTO data_domains (name, parent_id, sort_order)
SELECT v.name, personal.parent_id, v.sort_order
FROM personal
CROSS JOIN (VALUES
  ('Identifierade data', 10),
  ('Anstallningsrelaterad data', 20),
  ('Kansliga personuppgifter', 30)
) AS v(name, sort_order)
ON CONFLICT (parent_id, name) DO UPDATE
SET sort_order = EXCLUDED.sort_order;

-- Personaldata -> Identifierade data leafs
WITH p AS (
  SELECT c.id AS parent_id
  FROM data_domains c
  JOIN data_domains pp ON pp.id = c.parent_id
  WHERE pp.name = 'Personaldata' AND c.name = 'Identifierade data'
)
INSERT INTO data_domains (name, parent_id, sort_order)
SELECT v.name, p.parent_id, v.sort_order
FROM p
CROSS JOIN (VALUES
  ('Namn', 10),
  ('Personnummer', 20),
  ('Adress', 30),
  ('Kontaktuppgifter', 40)
) AS v(name, sort_order)
ON CONFLICT (parent_id, name) DO UPDATE
SET sort_order = EXCLUDED.sort_order;

-- Personaldata -> Anstallningsrelaterad data leafs
WITH p AS (
  SELECT c.id AS parent_id
  FROM data_domains c
  JOIN data_domains pp ON pp.id = c.parent_id
  WHERE pp.name = 'Personaldata' AND c.name = 'Anstallningsrelaterad data'
)
INSERT INTO data_domains (name, parent_id, sort_order)
SELECT v.name, p.parent_id, v.sort_order
FROM p
CROSS JOIN (VALUES
  ('Titel', 10),
  ('Lon', 20),
  ('Anstallningsnummer', 30),
  ('Arbetsplats', 40)
) AS v(name, sort_order)
ON CONFLICT (parent_id, name) DO UPDATE
SET sort_order = EXCLUDED.sort_order;

-- Personaldata -> Kansliga personuppgifter leafs
WITH p AS (
  SELECT c.id AS parent_id
  FROM data_domains c
  JOIN data_domains pp ON pp.id = c.parent_id
  WHERE pp.name = 'Personaldata' AND c.name = 'Kansliga personuppgifter'
)
INSERT INTO data_domains (name, parent_id, sort_order)
SELECT v.name, p.parent_id, v.sort_order
FROM p
CROSS JOIN (VALUES
  ('Halsodata', 10),
  ('Fackligtillhorighet', 20)
) AS v(name, sort_order)
ON CONFLICT (parent_id, name) DO UPDATE
SET sort_order = EXCLUDED.sort_order;

-- Transaktionsdata children
WITH top AS (
  SELECT id FROM data_domains WHERE parent_id IS NULL AND name = 'Transaktionsdata'
)
INSERT INTO data_domains (name, parent_id, sort_order)
SELECT v.name, top.id, v.sort_order
FROM top
CROSS JOIN (VALUES
  ('Matvarden', 10),
  ('Fakturering', 20),
  ('Orderdata', 30)
) AS v(name, sort_order)
ON CONFLICT (parent_id, name) DO UPDATE
SET sort_order = EXCLUDED.sort_order;

-- Matvarden leafs
WITH p AS (
  SELECT c.id AS parent_id
  FROM data_domains c
  JOIN data_domains t ON t.id = c.parent_id
  WHERE t.name = 'Transaktionsdata' AND c.name = 'Matvarden'
)
INSERT INTO data_domains (name, parent_id, sort_order)
SELECT v.name, p.parent_id, v.sort_order
FROM p
CROSS JOIN (VALUES
  ('Energiforbrukning', 10),
  ('Vattenflode', 20),
  ('Temperatur', 30),
  ('Tryck', 40)
) AS v(name, sort_order)
ON CONFLICT (parent_id, name) DO UPDATE
SET sort_order = EXCLUDED.sort_order;

-- Fakturering leafs
WITH p AS (
  SELECT c.id AS parent_id
  FROM data_domains c
  JOIN data_domains t ON t.id = c.parent_id
  WHERE t.name = 'Transaktionsdata' AND c.name = 'Fakturering'
)
INSERT INTO data_domains (name, parent_id, sort_order)
SELECT v.name, p.parent_id, v.sort_order
FROM p
CROSS JOIN (VALUES
  ('Fakturabelopp', 10),
  ('Betalstatus', 20),
  ('Datum', 30)
) AS v(name, sort_order)
ON CONFLICT (parent_id, name) DO UPDATE
SET sort_order = EXCLUDED.sort_order;

-- Orderdata leafs
WITH p AS (
  SELECT c.id AS parent_id
  FROM data_domains c
  JOIN data_domains t ON t.id = c.parent_id
  WHERE t.name = 'Transaktionsdata' AND c.name = 'Orderdata'
)
INSERT INTO data_domains (name, parent_id, sort_order)
SELECT v.name, p.parent_id, v.sort_order
FROM p
CROSS JOIN (VALUES
  ('Servicearenden', 10),
  ('Installationer', 20),
  ('Avbrott', 30)
) AS v(name, sort_order)
ON CONFLICT (parent_id, name) DO UPDATE
SET sort_order = EXCLUDED.sort_order;

-- Referensdata children
WITH top AS (
  SELECT id FROM data_domains WHERE parent_id IS NULL AND name = 'Referensdata'
)
INSERT INTO data_domains (name, parent_id, sort_order)
SELECT v.name, top.id, v.sort_order
FROM top
CROSS JOIN (VALUES
  ('Kodlistor', 10),
  ('Klassificeringar', 20)
) AS v(name, sort_order)
ON CONFLICT (parent_id, name) DO UPDATE
SET sort_order = EXCLUDED.sort_order;

-- Kodlistor leafs
WITH p AS (
  SELECT c.id AS parent_id
  FROM data_domains c
  JOIN data_domains t ON t.id = c.parent_id
  WHERE t.name = 'Referensdata' AND c.name = 'Kodlistor'
)
INSERT INTO data_domains (name, parent_id, sort_order)
SELECT v.name, p.parent_id, v.sort_order
FROM p
CROSS JOIN (VALUES
  ('ISO-enheter', 10),
  ('Statuskoder (Aktiv, Avslutad)', 20),
  ('Felkoder', 30)
) AS v(name, sort_order)
ON CONFLICT (parent_id, name) DO UPDATE
SET sort_order = EXCLUDED.sort_order;

-- Klassificeringar leafs
WITH p AS (
  SELECT c.id AS parent_id
  FROM data_domains c
  JOIN data_domains t ON t.id = c.parent_id
  WHERE t.name = 'Referensdata' AND c.name = 'Klassificeringar'
)
INSERT INTO data_domains (name, parent_id, sort_order)
SELECT v.name, p.parent_id, v.sort_order
FROM p
CROSS JOIN (VALUES
  ('Kundsegment', 10),
  ('Natomraden', 20)
) AS v(name, sort_order)
ON CONFLICT (parent_id, name) DO UPDATE
SET sort_order = EXCLUDED.sort_order;

-- Sensor- och IoT-data children (kept shallow)
WITH top AS (
  SELECT id FROM data_domains WHERE parent_id IS NULL AND name = 'Sensor- och IoT-data'
)
INSERT INTO data_domains (name, parent_id, sort_order)
SELECT v.name, top.id, v.sort_order
FROM top
CROSS JOIN (VALUES
  ('Realtidsdata fran matare och sensorer (El, Vatten, Varme)', 10),
  ('Driftstatus, larm, avvikelseindikatorer', 20)
) AS v(name, sort_order)
ON CONFLICT (parent_id, name) DO UPDATE
SET sort_order = EXCLUDED.sort_order;

-- Dokumentdata children
WITH top AS (
  SELECT id FROM data_domains WHERE parent_id IS NULL AND name = 'Dokumentdata'
)
INSERT INTO data_domains (name, parent_id, sort_order)
SELECT v.name, top.id, v.sort_order
FROM top
CROSS JOIN (VALUES
  ('Avtal, ritningar, manualer, arbetsorder', 10),
  ('PDF, Word, CAD-filer', 20)
) AS v(name, sort_order)
ON CONFLICT (parent_id, name) DO UPDATE
SET sort_order = EXCLUDED.sort_order;

-- Kommunikationsdata children
WITH top AS (
  SELECT id FROM data_domains WHERE parent_id IS NULL AND name = 'Kommunikationsdata'
)
INSERT INTO data_domains (name, parent_id, sort_order)
SELECT v.name, top.id, v.sort_order
FROM top
CROSS JOIN (VALUES
  ('E-post', 10),
  ('Chatloggar', 20),
  ('Kundservicearenden', 30)
) AS v(name, sort_order)
ON CONFLICT (parent_id, name) DO UPDATE
SET sort_order = EXCLUDED.sort_order;

-- Loggdata children
WITH top AS (
  SELECT id FROM data_domains WHERE parent_id IS NULL AND name = 'Loggdata'
)
INSERT INTO data_domains (name, parent_id, sort_order)
SELECT v.name, top.id, v.sort_order
FROM top
CROSS JOIN (VALUES
  ('Systemloggar', 10),
  ('API-anrop', 20),
  ('Integrationsfloden', 30)
) AS v(name, sort_order)
ON CONFLICT (parent_id, name) DO UPDATE
SET sort_order = EXCLUDED.sort_order;

