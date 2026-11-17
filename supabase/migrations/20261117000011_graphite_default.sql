-- Graphite (the dashboard's look) is the default guest page theme from now on.
alter table clients alter column theme set default 'graphite';
update clients set theme = 'graphite' where slug = 'demo-cafe';
