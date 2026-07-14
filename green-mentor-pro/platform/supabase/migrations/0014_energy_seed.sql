-- Energy module seed — reference masters for Fuel + Electricity. Idempotent
-- (on conflict do nothing), safe to re-run. DISCOM list lifted verbatim from the
-- legacy greenmentor-in-fe electricitySlice.js (62 Indian distribution companies).
-- Apply after 0013_energy.sql.

-- Fuel types (source_type drives Renewable/Non-Renewable badges)
insert into public.energy_fuel_types (name, source_type, sort) values
  ('Diesel','Non-Renewable',0),
  ('Petrol','Non-Renewable',1),
  ('CNG','Non-Renewable',2),
  ('LPG','Non-Renewable',3),
  ('High Speed Diesel','Non-Renewable',4),
  ('Furnace Oil','Non-Renewable',5),
  ('Coal','Non-Renewable',6),
  ('Natural Gas','Non-Renewable',7),
  ('Kerosene','Non-Renewable',8),
  ('Biomass','Renewable',9),
  ('Other','Non-Renewable',10)
on conflict (name) do nothing;

-- Fuel use types
insert into public.energy_use_types (name, sort) values
  ('Stationary Combustion',0),
  ('Mobile Combustion',1)
on conflict (name) do nothing;

-- Units
insert into public.energy_units (name, kind, sort) values
  ('litres','fuel',0),
  ('kilolitres','fuel',1),
  ('kg','fuel',2),
  ('tonnes','fuel',3),
  ('cubic metre','fuel',4),
  ('GJ','fuel',5),
  ('MMBTU','fuel',6),
  ('kWh','electricity',7),
  ('MWh','electricity',8)
on conflict (name) do nothing;

-- Currencies
insert into public.energy_currencies (code, name, sort) values
  ('INR','Indian Rupee',0),
  ('USD','US Dollar',1),
  ('EUR','Euro',2),
  ('GBP','Pound Sterling',3),
  ('JPY','Japanese Yen',4)
on conflict (code) do nothing;

-- Electricity sources
insert into public.energy_electricity_sources (name, source_type, sort) values
  ('Grid Electricity','Non-Renewable',0),
  ('Diesel Generator','Non-Renewable',1),
  ('Solar','Renewable',2),
  ('Wind','Renewable',3),
  ('Hydro','Renewable',4),
  ('Biomass Power','Renewable',5)
on conflict (name) do nothing;

-- Transaction types
insert into public.energy_transaction_types (name, sort) values
  ('Purchased',0),
  ('Captive',1)
on conflict (name) do nothing;

-- Electricity boards (DISCOMs)
insert into public.energy_electricity_boards (name, sort) values
  ('Himachal Pradesh State Electricity Board Limited',0),
  ('Tata Power Delhi Distribution Limited',1),
  ('BSES Rajdhani Power Limited',2),
  ('BSES Yamuna Power Limited',3),
  ('New Delhi Municipal Corporation',4),
  ('Uttar haryana Bijli Vitran Nigam',5),
  ('Dakshin Haryana Bijli Vitran Nigam',6),
  ('Uttarakhand Power Corporation Limited',7),
  ('Punjab State Power Corporation Limited',8),
  ('Purvanchal Vidyut Vitran Nigam Ltd.',9),
  ('Paschimanchal Vidyut Vitran Limited',10),
  ('Madhyanchal Vidyut Vitran Limited',11),
  ('Dhakshinachal Vidyut Vitran Limited',12),
  ('Electricity Department, UT of Chandigarh',13),
  ('Power Development Department Jammu & Kashmir',14),
  ('Manipur State Power Distribution Company Ltd',15),
  ('Department of Power, Arunachal Pradesh',16),
  ('Department of Power, Nagaland',17),
  ('Sikkim Power Development Corporation Limited',18),
  ('Meghalaya Energy Distribution Corporation Limited',19),
  ('Power & Electricity Department, Government of Mizoram',20),
  ('North Bihar Power Distribution Company Limited',21),
  ('South Bihar Power Distribution Company Limited',22),
  ('Assam Power Distribution Company Limited',23),
  ('Tripura State Electricity Corporation Limited',24),
  ('Kerala State Electricity Board Limited',25),
  ('Chamundeshwari Electricity Supply Corporation Limited',26),
  ('Gulbarga Electricity Supply Company Limited',27),
  ('Bangalore Electricity Supply Company Limited',28),
  ('Mangalore Electricity Supply Company Limited',29),
  ('Hubli Electricity Supply Company Limited',30),
  ('Telangana State Southern Power Distribution Company Ltd',31),
  ('Telangana State Northern Power Distribution Company Ltd',32),
  ('Electricity Department, UT of Lakshadweep',33),
  ('Electricity Department, UT of Puducherry',34),
  ('Electricity Department, UT of Andaman & Nicobar',35),
  ('Southern Power Distribution Company of A.P. Limited',36),
  ('Andhra Pradesh Eastern Power Distribution Company Ltd',37),
  ('Tamil Nadu Generation & Distribution Corporation Limited',38),
  ('Uttar Gujarat Vij Company Limited',39),
  ('Madhya Gujarat Vij Company Limited',40),
  ('Paschim Gujarat Vij Company Limited',41),
  ('Dakshin Gujarat Vij Company Limited',42),
  ('Electricity Department, Government of Goa',43),
  ('Madhya Pradesh Madhya Kshetra Vidyut Vitran Company Limited',44),
  ('MP Paschim Kshetra Vidyut Vitran Company Limited',45),
  ('MP Poorv Kshetra Vidyut Vitran Company Limited',46),
  ('Jaipur Vidyut Vitran Nigam Limited',47),
  ('Ajmer Vidyut Vitran Nigam Limited',48),
  ('Jodhpur Vidyut vitran Nigam Limited',49),
  ('Maharashtra State Electricity Distribution Co. Ltd.',50),
  ('Brihmanmumbai Electric Supply Company',51),
  ('Chhattisgarh State Power Distribution Company Ltd.',52),
  ('Dadra & Nagar Haveli Power Distribution Corporation Ltd',53),
  ('Electricity Department, UT of Daman & Diu',54),
  ('West Bengal State Electricity Distribution Company Limited',55),
  ('Durgapur Project Limited',56),
  ('Jharkhand Bijli Vitran Nigam Limited',57),
  ('North Eastern Supply Company Limited',58),
  ('Southern Electricity Supply Company Limited',59),
  ('Central Electricity Supply Company Limited',60),
  ('Western Electricity Supply Company of Odisha Limited',61)
on conflict (name) do nothing;
