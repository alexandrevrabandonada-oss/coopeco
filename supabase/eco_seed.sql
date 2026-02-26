-- ECO Seed Data
-- Neighborhoods (Territórios)
INSERT INTO neighborhoods (slug, name)
VALUES 
  ('centro', 'CENTRO'),
  ('vincualdo', 'VINCUALDO'),
  ('industrial', 'ZONA INDUSTRIAL'),
  ('porto', 'PORTO SECO')
ON CONFLICT (slug) DO NOTHING;

-- Partners (Sponsors/Recyclers)
INSERT INTO partners (slug, name, kind, description)
VALUES
  ('recicla-ja', 'RECICLA JÁ', 'collector', 'Centro de triagem de alta performance.'),
  ('eco-vidros', 'ECO VIDROS', 'recycler', 'Especializada em garrafas e vidros planos.'),
  ('cafe-solidario', 'CAFÉ SOLIDÁRIO', 'sponsor', 'Apoia a coleta local com pontos de fidelidade.')
ON CONFLICT (slug) DO NOTHING;

-- No PII or specific addresses here.
