CREATE TABLE `posts` (
  `post_id` int(11) PRIMARY KEY NOT NULL AUTO_INCREMENT,
  `author_id` int(11) NOT NULL,
  `topic` varchar(255) DEFAULT null,
  `content` text DEFAULT null,
  `date_added` datetime DEFAULT (current_timestamp())
);

CREATE TABLE `media_collections` (
  `media_collection_id` int(11) PRIMARY KEY NOT NULL AUTO_INCREMENT,
  `title` varchar(200) DEFAULT null,
  `description` varchar(255) DEFAULT null,
  `register_date` datetime DEFAULT (current_timestamp())
);

CREATE TABLE `collection_owners` (
  `user_id` int(11) NOT NULL,
  `media_collection_id` int(11) NOT NULL,
  `access_granted` datetime DEFAULT (current_timestamp()),
  PRIMARY KEY (`user_id`, `media_collection_id`)
);

CREATE TABLE `media_items` (
  `media_item_id` int(11) PRIMARY KEY NOT NULL AUTO_INCREMENT,
  `media_type` ENUM('PIC', 'VID', 'YT') NOT NULL,
  `file_id` int(11) NOT NULL,
  `title` varchar(255) DEFAULT null,
  `descr` text DEFAULT null,
  `tags` text DEFAULT null,
  `coordinates` longtext DEFAULT null,
  `creation_date` datetime DEFAULT null
);

CREATE TABLE `files` (
  `file_id` int(11) PRIMARY KEY NOT NULL AUTO_INCREMENT,
  `date_added` datetime DEFAULT (current_timestamp()),
  `size_in_kb` double DEFAULT null
);

CREATE TABLE `media_in_collection` (
  `media_item_id` int(11) NOT NULL,
  `media_collection_id` int(11) NOT NULL,
  `date_added` datetime DEFAULT (current_timestamp()),
  PRIMARY KEY (`media_item_id`, `media_collection_id`)
);

CREATE TABLE `media_in_post` (
  `media_item_id` int(11) NOT NULL,
  `post_id` int(11) NOT NULL,
  PRIMARY KEY (`media_item_id`, `post_id`)
);

CREATE TABLE `users` (
  `user_id` int(11) PRIMARY KEY NOT NULL AUTO_INCREMENT,
  `name` varchar(50) DEFAULT null,
  `password` varchar(255) DEFAULT null,
  `recovery_question` varchar(255) DEFAULT null,
  `recovery_answer` varchar(255) DEFAULT null,
  `is_admin` tinyint(1) DEFAULT null,
  `register_date` datetime DEFAULT null,
  `token` varchar(255) DEFAULT null,
  `token_validity` datetime DEFAULT null
);

CREATE INDEX `posts_index_0` ON `posts` (`author_id`);

CREATE INDEX `user_id` ON `collection_owners` (`user_id`);

CREATE INDEX `media_collection_id` ON `collection_owners` (`media_collection_id`);

CREATE INDEX `media_item_id_idx` ON `media_in_collection` (`media_item_id`);

CREATE INDEX `collection_id_idx` ON `media_in_collection` (`media_collection_id`);

CREATE UNIQUE INDEX `name_UNIQUE` ON `users` (`name`);

ALTER TABLE `media_items` ADD CONSTRAINT `media_file_ref` FOREIGN KEY (`file_id`) REFERENCES `files` (`file_id`);

ALTER TABLE `posts` ADD CONSTRAINT `post_authors_ref` FOREIGN KEY (`author_id`) REFERENCES `users` (`user_id`);

ALTER TABLE `collection_owners` ADD CONSTRAINT `collection_owners_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`);

ALTER TABLE `collection_owners` ADD CONSTRAINT `collection_owners_ibfk_2` FOREIGN KEY (`media_collection_id`) REFERENCES `media_collections` (`media_collection_id`);

ALTER TABLE `media_in_collection` ADD CONSTRAINT `fk_mic_collection_id` FOREIGN KEY (`media_collection_id`) REFERENCES `media_collections` (`media_collection_id`);
ALTER TABLE `media_in_collection` ADD CONSTRAINT `fk_mic_item_id` FOREIGN KEY (`media_item_id`) REFERENCES `media_items` (`media_item_id`);

ALTER TABLE `media_in_post` ADD CONSTRAINT `fk_mip_post_id` FOREIGN KEY (`post_id`) REFERENCES `posts` (`post_id`);
ALTER TABLE `media_in_post` ADD CONSTRAINT `fk_mip_item_id` FOREIGN KEY (`media_item_id`) REFERENCES `media_items` (`media_item_id`);