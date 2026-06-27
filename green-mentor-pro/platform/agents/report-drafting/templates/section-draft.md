{{!-- Report section render template. Filled per report_sections[] entry. --}}
## {{title}}

{{body_markdown}}

{{#if chart_refs}}
_Figures: {{#each chart_refs}}{{this}}{{#unless @last}}, {{/unless}}{{/each}}_
{{/if}}
