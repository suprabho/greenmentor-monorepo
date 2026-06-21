{{!-- Materiality matrix render template. Filled from materiality_matrix artifact. --}}
# Materiality Assessment — {{client_legal_name}}

Threshold: impact + financial significance ≥ {{materiality_threshold}}

| Topic | Impact (0–5) | Financial (0–5) | Material? | Rationale |
|---|---|---|---|---|
{{#each scored_topics}}| {{label}} | {{impact_score}} | {{financial_score}} | {{#if material}}✓{{else}}—{{/if}} | {{rationale}} |
{{/each}}

## Proposed material topics (ranked)
{{#each material_topics}}{{rank}}. **{{label}}** ({{status}})
{{/each}}
