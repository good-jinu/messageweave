CREATE TABLE `event` (
	`id` text PRIMARY KEY NOT NULL,
	`roomId` text NOT NULL,
	`senderId` text NOT NULL,
	`type` text NOT NULL,
	`stateKey` text,
	`content` text NOT NULL,
	`timestamp` integer NOT NULL,
	`sequenceId` integer NOT NULL,
	FOREIGN KEY (`roomId`) REFERENCES `room`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `event_sequenceId_unique` ON `event` (`sequenceId`);--> statement-breakpoint
CREATE TABLE `eventEdge` (
	`id` text PRIMARY KEY NOT NULL,
	`eventId` text NOT NULL,
	`parentEventId` text NOT NULL,
	FOREIGN KEY (`eventId`) REFERENCES `event`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `room` (
	`id` text PRIMARY KEY NOT NULL,
	`creatorId` text NOT NULL,
	`createdAt` integer NOT NULL,
	`metadata` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `roomState` (
	`id` text PRIMARY KEY NOT NULL,
	`roomId` text NOT NULL,
	`eventType` text NOT NULL,
	`stateKey` text NOT NULL,
	`eventId` text NOT NULL,
	FOREIGN KEY (`roomId`) REFERENCES `room`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`eventId`) REFERENCES `event`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `sequence` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`value` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `sequence_name_unique` ON `sequence` (`name`);