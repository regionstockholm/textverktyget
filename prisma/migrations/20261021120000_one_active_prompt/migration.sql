-- Preserve every version; keep the latest version active if earlier races left duplicates.
WITH ranked AS (
  SELECT id, row_number() OVER (PARTITION BY name ORDER BY version DESC, id DESC) AS position
  FROM prompt_templates WHERE is_active
)
UPDATE prompt_templates SET is_active = false
WHERE id IN (SELECT id FROM ranked WHERE position > 1);

CREATE UNIQUE INDEX prompt_templates_one_active_name ON prompt_templates (name) WHERE is_active;
