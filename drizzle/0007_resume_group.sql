/*
 Where a caller resumes moves from the browser to their user row, beside the
 library it belongs to, so the entry redirect can compute the whole landing url
 rather than the app bouncing itself into the group after it loads.

 Starts null, which is the library itself: nobody's last group is known until
 they open one.
*/
ALTER TABLE `users` ADD `group_id` text;
