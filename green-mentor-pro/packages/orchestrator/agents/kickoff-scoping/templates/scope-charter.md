{{!-- Scope charter render template. Filled from scope_plan.scope_charter. --}}
# Scope Charter — {{client_legal_name}} ({{reporting_period_label}})

## Objectives
{{#each objectives}}- {{this}}
{{/each}}

## Frameworks in scope
{{#each frameworks_in_scope}}- **{{framework}}**{{#if mandatory}} (mandatory){{/if}} — {{rationale}}
{{/each}}

## Reporting boundary
{{reporting_boundary}}

## Out of scope
{{#each out_of_scope}}- {{this}}
{{/each}}

## Open questions for the client
{{#each open_questions}}- {{this}}
{{/each}}
