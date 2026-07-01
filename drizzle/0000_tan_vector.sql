CREATE TABLE "homeruns" (
	"id" serial PRIMARY KEY NOT NULL,
	"season" integer NOT NULL,
	"play_id" text NOT NULL,
	"title" text NOT NULL,
	"exit_velocity" real,
	"hit_distance" real,
	"launch_angle" real,
	"video" text,
	CONSTRAINT "homeruns_play_id_unique" UNIQUE("play_id")
);
--> statement-breakpoint
CREATE TABLE "notes" (
	"id" serial PRIMARY KEY NOT NULL,
	"body" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stats_embeddings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_table" text,
	"source_id" uuid,
	"column_name" text,
	"content" text,
	"model" text,
	"embedding" vector(1536),
	CONSTRAINT "stats_embeddings_source_table_source_id_column_name_unique" UNIQUE("source_table","source_id","column_name")
);
--> statement-breakpoint
CREATE TABLE "stats_game_batting" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"game_id" uuid,
	"team_id" uuid,
	"person_id" uuid,
	"batting_order" text,
	"position" text,
	"at_bats" integer,
	"runs" integer,
	"hits" integer,
	"doubles" integer,
	"triples" integer,
	"home_runs" integer,
	"rbi" integer,
	"base_on_balls" integer,
	"strike_outs" integer,
	"stolen_bases" integer,
	"left_on_base" integer,
	"total_bases" integer,
	"plate_appearances" integer,
	"hit_by_pitch" integer,
	"sac_flies" integer,
	"sac_bunts" integer,
	"ground_into_double_play" integer,
	"raw" jsonb,
	CONSTRAINT "stats_game_batting_game_id_person_id_unique" UNIQUE("game_id","person_id")
);
--> statement-breakpoint
CREATE TABLE "stats_game_fielding" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"game_id" uuid,
	"team_id" uuid,
	"person_id" uuid,
	"put_outs" integer,
	"assists" integer,
	"errors" integer,
	"chances" integer,
	"passed_ball" integer,
	"pickoffs" integer,
	"raw" jsonb,
	CONSTRAINT "stats_game_fielding_game_id_person_id_unique" UNIQUE("game_id","person_id")
);
--> statement-breakpoint
CREATE TABLE "stats_game_pitching" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"game_id" uuid,
	"team_id" uuid,
	"person_id" uuid,
	"innings_pitched" text,
	"hits" integer,
	"runs" integer,
	"earned_runs" integer,
	"home_runs" integer,
	"base_on_balls" integer,
	"strike_outs" integer,
	"batters_faced" integer,
	"pitches_thrown" integer,
	"balls" integer,
	"strikes" integer,
	"wins" integer,
	"losses" integer,
	"saves" integer,
	"holds" integer,
	"blown_saves" integer,
	"hit_batsmen" integer,
	"wild_pitches" integer,
	"balks" integer,
	"raw" jsonb,
	CONSTRAINT "stats_game_pitching_game_id_person_id_unique" UNIQUE("game_id","person_id")
);
--> statement-breakpoint
CREATE TABLE "stats_games" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"game_pk" integer NOT NULL,
	"game_guid" text,
	"season" integer,
	"game_type" text,
	"game_date" text,
	"official_date" text,
	"away_team_id" uuid,
	"home_team_id" uuid,
	"away_score" integer,
	"home_score" integer,
	"venue_id" uuid,
	"status_abstract" text,
	"status_detailed" text,
	"status_coded" text,
	"day_night" text,
	"double_header" text,
	"game_number" integer,
	"series_description" text,
	"series_game_number" integer,
	"games_in_series" integer,
	"scheduled_innings" integer,
	"weather_condition" text,
	"weather_temp" text,
	"weather_wind" text,
	"win_pitcher_id" uuid,
	"loss_pitcher_id" uuid,
	"save_pitcher_id" uuid,
	"attendance" integer,
	"raw" jsonb,
	CONSTRAINT "stats_games_game_pk_unique" UNIQUE("game_pk")
);
--> statement-breakpoint
CREATE TABLE "stats_homeruns" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"season" integer,
	"play_id" text,
	"title" text,
	"exit_velocity" real,
	"hit_distance" real,
	"launch_angle" real,
	"video" text,
	"raw" jsonb
);
--> statement-breakpoint
CREATE TABLE "stats_linescore" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"game_id" uuid,
	"inning" integer,
	"ordinal" text,
	"home_runs" integer,
	"home_hits" integer,
	"home_errors" integer,
	"home_lob" integer,
	"away_runs" integer,
	"away_hits" integer,
	"away_errors" integer,
	"away_lob" integer,
	"raw" jsonb,
	CONSTRAINT "stats_linescore_game_id_inning_unique" UNIQUE("game_id","inning")
);
--> statement-breakpoint
CREATE TABLE "stats_officials" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"game_id" uuid,
	"official_type" text,
	"person_id" uuid,
	"full_name" text,
	"raw" jsonb
);
--> statement-breakpoint
CREATE TABLE "stats_people" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"mlb_id" integer NOT NULL,
	"full_name" text,
	"first_name" text,
	"last_name" text,
	"primary_number" text,
	"birth_date" text,
	"current_age" integer,
	"birth_city" text,
	"birth_country" text,
	"height" text,
	"weight" integer,
	"active" boolean,
	"position_code" text,
	"position_name" text,
	"position_type" text,
	"position_abbrev" text,
	"bat_side_code" text,
	"bat_side_desc" text,
	"pitch_hand_code" text,
	"pitch_hand_desc" text,
	"mlb_debut_date" text,
	"raw" jsonb,
	CONSTRAINT "stats_people_mlb_id_unique" UNIQUE("mlb_id")
);
--> statement-breakpoint
CREATE TABLE "stats_pitches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"game_id" uuid,
	"play_id_fk" uuid,
	"at_bat_index" integer,
	"pitch_number" integer,
	"play_id" text,
	"call_code" text,
	"call_description" text,
	"description" text,
	"pitch_type_code" text,
	"pitch_type_desc" text,
	"is_in_play" boolean,
	"is_strike" boolean,
	"is_ball" boolean,
	"start_speed" real,
	"end_speed" real,
	"strike_zone_top" real,
	"strike_zone_bottom" real,
	"zone" integer,
	"type_confidence" real,
	"plate_time" real,
	"extension" real,
	"px" real,
	"pz" real,
	"pfx_x" real,
	"pfx_z" real,
	"break_angle" real,
	"break_length" real,
	"break_vertical" real,
	"break_vertical_induced" real,
	"break_horizontal" real,
	"spin_rate" integer,
	"spin_direction" integer,
	"exit_velocity" real,
	"launch_angle" real,
	"total_distance" real,
	"trajectory" text,
	"hardness" text,
	"hit_location" text,
	"hit_coord_x" real,
	"hit_coord_y" real,
	"raw" jsonb,
	CONSTRAINT "stats_pitches_game_id_at_bat_index_pitch_number_unique" UNIQUE("game_id","at_bat_index","pitch_number")
);
--> statement-breakpoint
CREATE TABLE "stats_plays" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"game_id" uuid,
	"at_bat_index" integer,
	"result_type" text,
	"event" text,
	"event_type" text,
	"description" text,
	"rbi" integer,
	"is_out" boolean,
	"is_scoring_play" boolean,
	"half_inning" text,
	"inning" integer,
	"balls" integer,
	"strikes" integer,
	"outs" integer,
	"batter_id" uuid,
	"pitcher_id" uuid,
	"bat_side" text,
	"pitch_hand" text,
	"raw" jsonb,
	CONSTRAINT "stats_plays_game_id_at_bat_index_unique" UNIQUE("game_id","at_bat_index")
);
--> statement-breakpoint
CREATE TABLE "stats_runners" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"game_id" uuid,
	"play_id_fk" uuid,
	"runner_id" uuid,
	"origin_base" text,
	"start_base" text,
	"end_base" text,
	"out_base" text,
	"is_out" boolean,
	"is_scoring_event" boolean,
	"rbi" boolean,
	"earned" boolean,
	"event" text,
	"event_type" text,
	"responsible_pitcher_id" uuid,
	"raw" jsonb
);
--> statement-breakpoint
CREATE TABLE "stats_teams" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"mlb_id" integer NOT NULL,
	"name" text,
	"abbreviation" text,
	"team_name" text,
	"location_name" text,
	"league_id" integer,
	"league_name" text,
	"division_id" integer,
	"division_name" text,
	"venue_mlb_id" integer,
	"first_year_of_play" text,
	"active" boolean,
	"raw" jsonb,
	CONSTRAINT "stats_teams_mlb_id_unique" UNIQUE("mlb_id")
);
--> statement-breakpoint
CREATE TABLE "stats_venues" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"mlb_id" integer NOT NULL,
	"name" text,
	"city" text,
	"state" text,
	"state_abbrev" text,
	"country" text,
	"latitude" real,
	"longitude" real,
	"elevation" integer,
	"capacity" integer,
	"turf_type" text,
	"roof_type" text,
	"left_line" integer,
	"center" integer,
	"right_line" integer,
	"timezone_id" text,
	"timezone_offset" integer,
	"raw" jsonb,
	CONSTRAINT "stats_venues_mlb_id_unique" UNIQUE("mlb_id")
);
--> statement-breakpoint
ALTER TABLE "stats_game_batting" ADD CONSTRAINT "stats_game_batting_game_id_stats_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."stats_games"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stats_game_batting" ADD CONSTRAINT "stats_game_batting_team_id_stats_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."stats_teams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stats_game_batting" ADD CONSTRAINT "stats_game_batting_person_id_stats_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."stats_people"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stats_game_fielding" ADD CONSTRAINT "stats_game_fielding_game_id_stats_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."stats_games"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stats_game_fielding" ADD CONSTRAINT "stats_game_fielding_team_id_stats_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."stats_teams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stats_game_fielding" ADD CONSTRAINT "stats_game_fielding_person_id_stats_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."stats_people"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stats_game_pitching" ADD CONSTRAINT "stats_game_pitching_game_id_stats_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."stats_games"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stats_game_pitching" ADD CONSTRAINT "stats_game_pitching_team_id_stats_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."stats_teams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stats_game_pitching" ADD CONSTRAINT "stats_game_pitching_person_id_stats_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."stats_people"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stats_games" ADD CONSTRAINT "stats_games_away_team_id_stats_teams_id_fk" FOREIGN KEY ("away_team_id") REFERENCES "public"."stats_teams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stats_games" ADD CONSTRAINT "stats_games_home_team_id_stats_teams_id_fk" FOREIGN KEY ("home_team_id") REFERENCES "public"."stats_teams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stats_games" ADD CONSTRAINT "stats_games_venue_id_stats_venues_id_fk" FOREIGN KEY ("venue_id") REFERENCES "public"."stats_venues"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stats_games" ADD CONSTRAINT "stats_games_win_pitcher_id_stats_people_id_fk" FOREIGN KEY ("win_pitcher_id") REFERENCES "public"."stats_people"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stats_games" ADD CONSTRAINT "stats_games_loss_pitcher_id_stats_people_id_fk" FOREIGN KEY ("loss_pitcher_id") REFERENCES "public"."stats_people"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stats_games" ADD CONSTRAINT "stats_games_save_pitcher_id_stats_people_id_fk" FOREIGN KEY ("save_pitcher_id") REFERENCES "public"."stats_people"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stats_linescore" ADD CONSTRAINT "stats_linescore_game_id_stats_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."stats_games"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stats_officials" ADD CONSTRAINT "stats_officials_game_id_stats_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."stats_games"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stats_officials" ADD CONSTRAINT "stats_officials_person_id_stats_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."stats_people"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stats_pitches" ADD CONSTRAINT "stats_pitches_game_id_stats_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."stats_games"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stats_pitches" ADD CONSTRAINT "stats_pitches_play_id_fk_stats_plays_id_fk" FOREIGN KEY ("play_id_fk") REFERENCES "public"."stats_plays"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stats_plays" ADD CONSTRAINT "stats_plays_game_id_stats_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."stats_games"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stats_plays" ADD CONSTRAINT "stats_plays_batter_id_stats_people_id_fk" FOREIGN KEY ("batter_id") REFERENCES "public"."stats_people"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stats_plays" ADD CONSTRAINT "stats_plays_pitcher_id_stats_people_id_fk" FOREIGN KEY ("pitcher_id") REFERENCES "public"."stats_people"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stats_runners" ADD CONSTRAINT "stats_runners_game_id_stats_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."stats_games"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stats_runners" ADD CONSTRAINT "stats_runners_play_id_fk_stats_plays_id_fk" FOREIGN KEY ("play_id_fk") REFERENCES "public"."stats_plays"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stats_runners" ADD CONSTRAINT "stats_runners_runner_id_stats_people_id_fk" FOREIGN KEY ("runner_id") REFERENCES "public"."stats_people"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stats_runners" ADD CONSTRAINT "stats_runners_responsible_pitcher_id_stats_people_id_fk" FOREIGN KEY ("responsible_pitcher_id") REFERENCES "public"."stats_people"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "stats_embeddings_hnsw" ON "stats_embeddings" USING hnsw ("embedding" vector_cosine_ops);