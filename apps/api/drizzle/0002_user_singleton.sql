-- Single-user: the sign-up hook in src/auth.ts checks for an existing account,
-- but two concurrent sign-ups can both pass it. SQLite serializes writes, so
-- this check is atomic with the insert.
CREATE TRIGGER `user_singleton`
BEFORE INSERT ON `user`
WHEN EXISTS (SELECT 1 FROM `user`)
BEGIN
	SELECT RAISE(ABORT, 'An account already exists');
END;
