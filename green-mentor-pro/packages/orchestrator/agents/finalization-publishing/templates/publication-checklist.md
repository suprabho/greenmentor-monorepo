{{!-- Publication checklist render template. Filled from publication_checklist[]. --}}
# Publication Checklist — {{client_legal_name}} {{reporting_period_label}}

{{#each publication_checklist}}- [{{#if done}}x{{else}} {{/if}}] {{item}}
{{/each}}

## Investor summary highlights
{{#each investor_summary.highlights}}- {{this}}
{{/each}}
