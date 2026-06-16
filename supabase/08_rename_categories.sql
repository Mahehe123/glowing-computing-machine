-- ============================================================
-- Rename product categories to the equipment-family taxonomy.
-- Safe to run once (idempotent — only touches old names).
-- ============================================================
update public.products set category = 'Air compressor'    where category in ('Oil free compressor', 'Oil lube compressor');
update public.products set category = 'Air receiver tank'  where category = 'Air Tank';
update public.products set category = 'Filter'             where category = 'Air filter';
-- 'Dryer' is unchanged.
