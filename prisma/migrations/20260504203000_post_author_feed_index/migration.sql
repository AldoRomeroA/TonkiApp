-- CreateIndex
CREATE INDEX `Post_author_id_created_at_post_id_idx` ON `Post` (`author_id`, `created_at` DESC, `post_id` ASC);
