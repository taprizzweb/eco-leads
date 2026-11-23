-- A kitchen role: cooks sign in on their own phone and see only the orders to cook. (Separate file: a new enum value cannot be used in the same transaction.)
alter type member_role add value if not exists 'kitchen';
