-- Fugitive masters seed — IPCC AR5 & AR6 GWP-100 values for common GHGs and
-- refrigerants, plus equipment types with default leak / emission rates.
-- Idempotent (on conflict do nothing). Apply after 0015_energy_fugitive.sql.
--
-- GWP-100 sources: IPCC AR5 (2014) WG1 Ch8 Table 8.A.1; IPCC AR6 (2021) WG1 Ch7
-- Table 7.15. Blend values (R-410A/404A/407C) are composition-weighted. Use these
-- as sensible defaults; a facility may override with a bill-specific factor later.

insert into public.energy_gas_gwp (gas, source, gwp, sort) values
  ('CO2','IPCC AR5',1,0),
  ('CO2','IPCC AR6',1,0),
  ('CH4 (Methane)','IPCC AR5',28,1),
  ('CH4 (Methane)','IPCC AR6',27,1),
  ('N2O (Nitrous oxide)','IPCC AR5',265,2),
  ('N2O (Nitrous oxide)','IPCC AR6',273,2),
  ('SF6','IPCC AR5',23500,3),
  ('SF6','IPCC AR6',25200,3),
  ('NF3','IPCC AR5',16100,4),
  ('NF3','IPCC AR6',17400,4),
  ('HFC-23','IPCC AR5',12400,5),
  ('HFC-23','IPCC AR6',14600,5),
  ('HFC-32 (R-32)','IPCC AR5',677,6),
  ('HFC-32 (R-32)','IPCC AR6',771,6),
  ('HFC-125 (R-125)','IPCC AR5',3170,7),
  ('HFC-125 (R-125)','IPCC AR6',3740,7),
  ('HFC-134a (R-134a)','IPCC AR5',1300,8),
  ('HFC-134a (R-134a)','IPCC AR6',1530,8),
  ('HFC-143a (R-143a)','IPCC AR5',4800,9),
  ('HFC-143a (R-143a)','IPCC AR6',5810,9),
  ('HFC-152a','IPCC AR5',138,10),
  ('HFC-152a','IPCC AR6',164,10),
  ('HFC-227ea','IPCC AR5',3350,11),
  ('HFC-227ea','IPCC AR6',3600,11),
  ('HFC-236fa','IPCC AR5',8060,12),
  ('HFC-236fa','IPCC AR6',8690,12),
  ('HFC-245fa','IPCC AR5',858,13),
  ('HFC-245fa','IPCC AR6',962,13),
  ('R-404A','IPCC AR5',3943,14),
  ('R-404A','IPCC AR6',4728,14),
  ('R-407C','IPCC AR5',1624,15),
  ('R-407C','IPCC AR6',1908,15),
  ('R-410A','IPCC AR5',1924,16),
  ('R-410A','IPCC AR6',2256,16),
  ('R-507A','IPCC AR5',3985,17),
  ('R-507A','IPCC AR6',4776,17),
  ('HCFC-22 (R-22)','IPCC AR5',1760,18),
  ('HCFC-22 (R-22)','IPCC AR6',1960,18),
  ('R-1234yf (HFO)','IPCC AR5',1,19),
  ('R-1234yf (HFO)','IPCC AR6',1,19),
  ('PFC-14 (CF4)','IPCC AR5',6630,20),
  ('PFC-14 (CF4)','IPCC AR6',7380,20),
  ('PFC-116 (C2F6)','IPCC AR5',11100,21),
  ('PFC-116 (C2F6)','IPCC AR6',12400,21)
on conflict (gas, source) do nothing;

insert into public.energy_equipment_types (name, category, leak_rate, min_capacity, max_capacity, sort) values
  ('Domestic refrigeration','refrigeration',0.006,0.05,0.5,0),
  ('Stand-alone commercial','refrigeration',0.1,0.2,6,1),
  ('Medium & large commercial refrigeration','refrigeration',0.15,50,2000,2),
  ('Industrial refrigeration','refrigeration',0.12,10,10000,3),
  ('Chillers','refrigeration',0.08,10,2000,4),
  ('Residential & commercial A/C (split)','refrigeration',0.08,0.5,100,5),
  ('Mobile air conditioning','refrigeration',0.15,0.5,1.5,6),
  ('Transport refrigeration','refrigeration',0.25,3,8,7)
on conflict (name, category) do nothing;

insert into public.energy_equipment_types (name, category, leak_rate, sort) values
  ('Fixed Systems','fire_suppression',0.02,0),
  ('Portable Equipment','fire_suppression',0.01,1)
on conflict (name, category) do nothing;
