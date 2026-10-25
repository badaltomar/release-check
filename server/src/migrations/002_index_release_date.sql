-- The list is always sorted by date, newest first, and read one page at a time.
CREATE INDEX releases_date_idx ON releases (release_date DESC, id);
