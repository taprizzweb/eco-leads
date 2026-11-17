-- Packages: presets of feature switches. Prices are proposals; edit them in the admin panel.
insert into packages (id, name, price_inr, sort, features) values
('starter',  'Starter',  349,  1, '{"menu":true,"review":true,"offers_strip":true,"keywords":true,"photo_limit":5,"complaints":false,"suggestions":false,"offers_card":false,"whatsapp_capture":false,"review_replies":"copy","moments":false,"events":false,"membership":false,"creators":false,"report":"basic","whatsapp_campaigns":"payg","content_help":false}'),
('growth',   'Growth',   999,  2, '{"menu":true,"review":true,"offers_strip":true,"keywords":true,"photo_limit":10,"complaints":true,"suggestions":true,"offers_card":true,"whatsapp_capture":true,"review_replies":"approve","moments":false,"events":false,"membership":false,"creators":false,"report":"full","whatsapp_campaigns":"payg","content_help":false}'),
('premium',  'Premium',  2499, 3, '{"menu":true,"review":true,"offers_strip":true,"keywords":true,"photo_limit":20,"complaints":true,"suggestions":true,"offers_card":true,"whatsapp_capture":true,"review_replies":"auto_4_5","moments":true,"events":true,"membership":true,"creators":true,"report":"full","whatsapp_campaigns":"some","content_help":false}'),
('retainer', 'Retainer', 9999, 4, '{"menu":true,"review":true,"offers_strip":true,"keywords":true,"photo_limit":30,"complaints":true,"suggestions":true,"offers_card":true,"whatsapp_capture":true,"review_replies":"managed","moments":true,"events":true,"membership":true,"creators":true,"report":"full_call","whatsapp_campaigns":"capped","content_help":true}');

-- Business templates: pre-fill wording, review chips, keywords and sample offers.
insert into business_templates (id, label, tagline, review_chips, keywords, card_copy, sample_offers, sort) values
('cafe', 'Cafe / Restaurant', 'Good food, slow mornings',
 '["Food","Coffee","Service","Ambience","Speed","Value"]',
 '{"Specialty Coffee","All-Day Dining","Pet Friendly","Free Wi-Fi","Family Friendly"}',
 '{"menu":{"title":"View menu","help":"Browse what is cooking today"}}',
 '[{"title":"HAPPY HOURS","details":"20% off on all beverages, 4 to 7 pm"}]', 1),
('salon', 'Salon / Spa', 'Look good, feel better',
 '["Stylist","Hygiene","Wait time","Service","Ambience","Value"]',
 '{"Hair & Colour","Bridal Makeup","Skin Care","Unisex","Hygienic Tools"}',
 '{"menu":{"title":"View services","help":"Prices for every service we offer"}}',
 '[{"title":"FIRST VISIT","details":"15% off your first haircut"}]', 2),
('gym', 'Gym / Fitness', 'Stronger every week',
 '["Trainers","Equipment","Cleanliness","Crowd","Classes","Value"]',
 '{"Personal Training","Strength Zone","Cardio","Group Classes","Open Early"}',
 '{"menu":{"title":"View plans","help":"Memberships and classes"}}',
 '[{"title":"FREE TRIAL","details":"One free day pass for a friend"}]', 3),
('hotel', 'Hotel', 'Stay a little longer',
 '["Room","Staff","Cleanliness","Check-in","Food","Location"]',
 '{"Free Breakfast","Free Wi-Fi","Parking","24h Front Desk","City Centre"}',
 '{"menu":{"title":"Room service menu","help":"Order to your room"}}',
 '[{"title":"LATE CHECKOUT","details":"Free till 1 pm on weekdays"}]', 4),
('clinic', 'Clinic', 'Care you can trust',
 '["Doctor","Staff","Wait time","Cleanliness","Explanation","Value"]',
 '{"Walk-ins Welcome","Online Booking","Experienced Doctors","Clean & Safe"}',
 '{"menu":{"title":"Services & timings","help":"Doctors, timings and fees"}}',
 '[]', 5),
('stay', 'Homestay / Villa', 'Your home in the hills',
 '["Host","Rooms","Cleanliness","View","Food","Location"]',
 '{"Private Pool","Mountain View","Pet Friendly","Bonfire","Home Food"}',
 '{"menu":{"title":"Stay guide","help":"House rules, Wi-Fi and nearby places"}}',
 '[{"title":"STAY 3 PAY 2","details":"On weekday bookings"}]', 6),
('resort', 'Resort / Getaway', 'Slow down, switch off',
 '["Rooms","Pool","Food","Staff","Activities","Value"]',
 '{"Infinity Pool","Spa","Adventure Activities","Couple Friendly","Buffet"}',
 '{"menu":{"title":"Resort guide","help":"Dining, activities and timings"}}',
 '[{"title":"SPA HOUR","details":"20% off spa treatments before noon"}]', 7);

-- Demo client so the guest page can be seen end to end (taprizz.in/e/demo1).
with c as (
  insert into clients (slug, name, business_type, tagline, google_review_url, menu_url, theme, socials, package_id, expires_at)
  values ('demo-cafe', 'Brew & Bloom', 'cafe', 'Specialty coffee and all-day plates',
          'https://search.google.com/local/writereview?placeid=ChIJN1t_tDeuEmsRUsoyG83frY4',
          'https://example.com/menu', 'navy',
          '{"instagram":"https://instagram.com/","facebook":"https://facebook.com/","maps":"https://maps.google.com/","phone":"+919999999999","zomato":"https://zomato.com/"}',
          'premium', current_date + 365)
  returning id
), p as (
  insert into plates (code, client_id, label) select 'demo1', id, 'Table 5' from c
), o as (
  insert into offers (client_id, title, details, ends_at, claimable)
  select id, x.t, x.d, current_date + 30, x.cl from c,
  (values ('HAPPY HOURS','20% off on all beverages, 4 to 7 pm', true),
          ('WEEKEND BRUNCH','Free dessert with every brunch plate', false),
          ('NEW','Cold brew tonic is here', false)) as x(t,d,cl)
), e as (
  insert into events (client_id, title, details, starts_at)
  select id, 'Open mic night', 'Bring a song, we bring the coffee', now() + interval '5 days' from c
), r as (
  insert into google_reviews (client_id, author, rating, body)
  select id, x.a, x.r, x.b from c,
  (values ('Ananya S.',5,'The pour-over here is the best in town. Staff remembered my order!'),
          ('Rahul M.',5,'Lovely corner seats, quick service and great avocado toast.'),
          ('Priya K.',4,'Calm place to work from. Cold brew is excellent.'),
          ('Vikram J.',5,'Came for coffee, stayed for the banana bread.')) as x(a,r,b)
)
insert into gallery_photos (client_id, url, label, caption, sort)
select id, x.u, x.l, x.c, x.s from c,
(values ('https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=900&fm=webp&q=70','BEST SELLER','Cappuccino',1),
        ('https://images.unsplash.com/photo-1504754524776-8f4f37790ca0?w=900&fm=webp&q=70',null,'Brunch plate',2),
        ('https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=900&fm=webp&q=70',null,'Pour-over',3),
        ('https://images.unsplash.com/photo-1554118811-1e0d58224f24?w=900&fm=webp&q=70',null,'Our corner',4)) as x(u,l,c,s);
