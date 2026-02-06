-- 009_node_metadata_and_data_domains (down)

DROP TABLE IF EXISTS edge_typed_flow_domains;
DROP TABLE IF EXISTS edge_typed_flows;
DROP TABLE IF EXISTS data_domains;

DROP TABLE IF EXISTS node_risk;
DROP TABLE IF EXISTS node_software;
DROP TABLE IF EXISTS node_owners;
ALTER TABLE nodes DROP COLUMN IF EXISTS owning_department;
DROP TABLE IF EXISTS node_supplier_types;
DROP TABLE IF EXISTS node_suppliers;

DROP TABLE IF EXISTS owners;
DROP TABLE IF EXISTS suppliers;

DO $$ BEGIN
  DROP TYPE IF EXISTS flow_direction;
  DROP TYPE IF EXISTS information_class;
  DROP TYPE IF EXISTS business_criticality;
  DROP TYPE IF EXISTS owning_department;
  DROP TYPE IF EXISTS supplier_type;
EXCEPTION WHEN undefined_object THEN NULL; END $$;

