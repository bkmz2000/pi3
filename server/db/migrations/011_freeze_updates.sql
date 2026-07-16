-- Per-teacher toggle: when 1, this account (and every student in a group they
-- own) has their service worker skip update activation until the teacher
-- flips the flag off. Backs the "install it, freeze it" promise on the
-- landing page — a lesson plan built in September still works in May.
ALTER TABLE users ADD COLUMN freeze_updates INTEGER NOT NULL DEFAULT 0;
