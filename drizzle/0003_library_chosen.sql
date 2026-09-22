ALTER TABLE `users` ADD `library_chosen` integer DEFAULT false NOT NULL;--> statement-breakpoint
-- Every row here predates the prompt, and its user has been using the app for
-- however long: the library they are in is already their answer.
UPDATE `users` SET `library_chosen` = true;
