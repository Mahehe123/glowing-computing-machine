-- Auto-generated from equipment_data_template.xlsx. Do not edit by hand.
-- Re-run scripts/generate_products_sql.py to regenerate.

-- Make sure the extra columns exist, then replace the catalog.
alter table public.products add column if not exists category text;
alter table public.products add column if not exists lead_time_weeks numeric;
delete from public.products;

insert into public.products (model, tpl, type, series, category, air_quality, wc_ac, kw, hp, cfm_min, cfm_max, price_rm, specs)
values ('AB110 - 10V', 'S411064', 'Water Lub, Air Cool, Oil-free, VFD', 'AB', 'Oil free compressor', 'Oil Free', 'Air Cooled', 110.0, 150.0, 191.0, 440.0, 0, '{"Loading Pressure": 10, "Unload Pressure": 10.5, "Min m3/min": 5.41, "Max m3/min": 12.46, "IE Rating": "IE3", "Motor Type": "TEFC, Class F, IP55", "Dimension": "3045 x 1870 x 1982", "Outlet size": "2.5\"", "Weight": 3723, "Noise level": 79, "Power Supply": "400v / 3 Ph / 50hz", "Outlet air temperature": "Ambient + 10degC", "Starter Type": "Inverter, VFD"}'::jsonb);
insert into public.products (model, tpl, type, series, category, air_quality, wc_ac, kw, hp, cfm_min, cfm_max, price_rm, specs)
values ('ATYF1000 HH', 'ATYF1000 HH', 'Air receiver tank, hand hole', 'AT', 'Air Tank', 'Air tank', null, null, null, null, null, 6829, '{"tank volume": 1000, "Air tank Material": "S275JR", "tank pressure": 10.3, "tank dimension": "780 (OD) x 2601", "tank outlet": "2\""}'::jsonb);
insert into public.products (model, tpl, type, series, category, air_quality, wc_ac, kw, hp, cfm_min, cfm_max, price_rm, specs)
values ('EGRD80', 'S04205', 'Refrigerant Dryer', 'Dryer', 'Dryer', null, 'Air Cooled', null, null, null, null, 0, '{"Refrigerant": "R134a", "Flow, m3/min": 2.4, "Flow, cfm": 85, "Power Supply": "230v / 1ph / 50hz", "Dimension": "420 x 380 x 775", "Outlet size": "1\"", "Weight, KG": 34, "Noise, dB": 70}'::jsonb);
insert into public.products (model, tpl, type, series, category, air_quality, wc_ac, kw, hp, cfm_min, cfm_max, price_rm, specs)
values ('EG75 - 10.5V', 'S016497', 'Air Cooled, Oil injected, Inverter', 'EG', 'Oil lube compressor', 'Oil injected', 'Air Cooled', 75.0, 100.0, 95.0, 454.0, 105319, '{"Loading Pressure": 9.5, "Unload Pressure": 10, "Min m3/min": 2.69, "Max m3/min": 12.86, "IE Rating": "IE3", "Motor Type": "TEFC, Class F, IP55", "Dimension": "2065 x 1355 x 1970", "Outlet size": "2.5\"", "Weight": 2040, "Noise level": 69, "Power Supply": "400v / 3 Ph / 50hz", "Outlet air temperature": "Ambient + 10\u00baC", "Starter Type": "Inverter, VFD"}'::jsonb);
insert into public.products (model, tpl, type, series, category, air_quality, wc_ac, kw, hp, cfm_min, cfm_max, price_rm, specs)
values ('AF 0021 P', 'B003308170001', 'Pre filter', 'AF', 'Air filter', 'Filter', null, null, null, null, null, 397, '{"Filter, m3/min": 0.59, "filter, cfm": 21, "filter oil carry over": 0.1, "Particle removal": 1, "filter dimension": "90 x 74 x 251", "filter outlet": "3/8\"", "filter weight": 1.05}'::jsonb);
insert into public.products (model, tpl, type, series, category, air_quality, wc_ac, kw, hp, cfm_min, cfm_max, price_rm, specs)
values ('AF 0021 F', 'B003308170019', 'Post filter', 'AF', 'Air filter', 'Filter', null, null, null, null, null, 397, '{"Filter, m3/min": 0.59, "filter, cfm": 21, "filter oil carry over": 0.01, "Particle removal": 0.01, "filter dimension": "90 x 74 x 251", "filter outlet": "3/8\"", "filter weight": 1.05}'::jsonb);
