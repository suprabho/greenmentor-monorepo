{{!-- Phase handoff summary template. Filled from the orchestration decision. --}}
**{{from_phase}} → {{next_phase}}**

{{handoff_summary}}

- Gate: {{gate_status}}
- Recommended action: **{{recommended_action}}**
{{#if open_review_items}}- ⚠️ {{open_review_items}} item(s) awaiting human review — gate is closed.{{/if}}
