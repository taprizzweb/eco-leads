-- Three plans (Starter 999, Growth 2,499, Pro 4,500) instead of four. Already applied to the live database from the admin panel;
-- this file keeps a fresh database in step. The old "retainer" plan is removed once no client uses it.
update packages set name = 'Starter', price_inr = 999, sort = 1, features = '{"menu":true,"review":true,"offers_strip":true,"keywords":true,"events":false,"creators":false,"complaints":false,"membership":false,"offers_card":false,"suggestions":false,"content_help":false,"whatsapp_capture":true,"photo_limit":10,"custom_links":3,"report":"basic","review_replies":"copy","whatsapp_campaigns":"payg"}' where id = 'starter';
update packages set name = 'Growth', price_inr = 2499, sort = 2, features = '{"menu":true,"review":true,"offers_strip":true,"keywords":true,"events":true,"creators":true,"complaints":true,"membership":false,"offers_card":true,"suggestions":true,"content_help":false,"whatsapp_capture":true,"photo_limit":20,"custom_links":6,"report":"full","review_replies":"approve","whatsapp_campaigns":"some"}' where id = 'growth';
update packages set name = 'Pro', price_inr = 4500, sort = 3, features = '{"menu":true,"review":true,"offers_strip":true,"keywords":true,"events":true,"creators":true,"complaints":true,"membership":true,"offers_card":true,"suggestions":true,"content_help":true,"whatsapp_capture":true,"photo_limit":30,"custom_links":12,"report":"full_call","review_replies":"auto_4_5","whatsapp_campaigns":"capped"}' where id = 'premium';
delete from packages where id = 'retainer' and not exists (select 1 from clients where package_id = 'retainer');

-- Share your moment and Creators corner are now one feature (creators). Remove the old switch everywhere.
update packages set features = features - 'moments';
update clients set feature_overrides = feature_overrides - 'moments' where feature_overrides ? 'moments';
