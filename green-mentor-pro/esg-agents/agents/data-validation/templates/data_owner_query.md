{{!-- Data-owner query template. Rendered into data_owner_queries[].question
     context for the portal/email. One issue → one query. Keep it answerable in
     one reply. --}}

Subject: Quick check needed — {{metric_label}} at {{site_name}} ({{period_label}})

Hi {{data_owner_first_name}},

While validating the {{financial_year}} sustainability data we flagged one item on
your submission and need your confirmation before it goes into the report:

**Issue ({{severity}}):** {{finding}}

{{#if check == "yoy"}}
The {{period_label}} value ({{current_value}} {{unit}}) is {{yoy_change_pct}}%
{{direction}} versus last year ({{prior_value}} {{unit}}). Is this expected
(e.g. capacity change, methodology change, site addition)? If so, a one-line reason
is enough; if not, please share the corrected figure.
{{/if}}

{{#if check == "reconciliation"}}
Two sources disagree beyond tolerance: {{source_a_label}} shows
{{source_a_value}} {{unit}}, but {{source_b_label}} shows {{source_b_value}} {{unit}}
({{variance_pct}}% apart). Which is authoritative, and why?
{{/if}}

{{#if check == "completeness" or check == "gap"}}
We're missing **{{metric_label}}** for {{period_label}}. Could you provide the value
in **{{required_unit}}**{{#if needs_evidence}}, along with a supporting document
(bill / meter log / invoice){{/if}}?
{{/if}}

{{#if check == "outlier"}}
This value ({{current_value}} {{unit}}) tripped our anomaly check ({{outlier_rule}}).
Please confirm it is correct, or send the corrected figure and source.
{{/if}}

Suggested resolution on our side: _{{suggested_fix}}_ — but we'll defer to your
confirmation.

Please reply on the portal — {{portal_link}} — by **{{deadline}}**.

Thanks,
GreenMentor Data Quality
