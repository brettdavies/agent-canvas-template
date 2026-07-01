CREATE TABLE `stats_games` (
	`game_pk` integer PRIMARY KEY NOT NULL,
	`season` integer,
	`game_type` text,
	`official_date` text,
	`away_team_id` integer,
	`away_name` text,
	`away_score` integer,
	`home_team_id` integer,
	`home_name` text,
	`home_score` integer,
	`status_detailed` text,
	`venue_name` text
);
--> statement-breakpoint
CREATE TABLE `stats_teams` (
	`mlb_id` integer PRIMARY KEY NOT NULL,
	`name` text,
	`abbreviation` text,
	`league_name` text,
	`division_name` text,
	`active` integer
);
