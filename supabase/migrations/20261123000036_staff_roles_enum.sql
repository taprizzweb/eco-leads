-- Two more roles a business owner can give to their own people. (Separate file: a new enum value cannot be used in the same transaction.)
alter type member_role add value if not exists 'reception';
alter type member_role add value if not exists 'waiter';
