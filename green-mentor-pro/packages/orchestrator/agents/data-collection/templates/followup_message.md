{{!-- Follow-up message template for an unfulfilled data-request line item.
     Rendered by the agent into followups[].message. Tone: concise, professional,
     specific. Variables come from the request line item + fulfilment reason. --}}

Subject: Action needed — {{metric_label}} for {{site_name}} ({{period_label}})

Hi {{data_owner_first_name}},

As part of the {{financial_year}} sustainability data collection, we still need the
following item to complete your site's submission:

- **What:** {{metric_label}} ({{disclosure_code}})
- **Period:** {{period_start}} to {{period_end}}
- **Required unit:** {{required_unit}}
- **Acceptable evidence:** {{evidence_examples}}   {{!-- e.g. utility bill, meter log, invoice --}}
- **Status:** {{status_reason}}   {{!-- missing / partial / the uploaded file was outside the billing period / value flagged as anomalous --}}

{{#if is_anomalous}}
Note: the figure we received ({{received_value}} {{received_unit}}) is materially
different from the prior period ({{expected_magnitude}} {{required_unit}}). Could you
confirm the value and unit, or share the source document so we can verify?
{{/if}}

Please upload directly via your portal request page — {{portal_link}} — by
**{{deadline}}**. Reply here if the data lives in a system we should connect to
instead.

Thanks,
GreenMentor Data Collection
