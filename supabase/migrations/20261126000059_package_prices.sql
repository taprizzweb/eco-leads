-- Owner's prices: Starter 1,700, Growth 2,700, Pro 3,500 (already applied to the live database).
update packages set price_inr = case id when 'starter' then 1700 when 'growth' then 2700 when 'premium' then 3500 end, updated_at = now() where id in ('starter', 'growth', 'premium');
