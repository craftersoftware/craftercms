CREATE DATABASE IF NOT EXISTS @crafter_schema_name
	DEFAULT CHARACTER SET utf8mb3
	COLLATE utf8mb3_uca1400_ai_ci ;

FLUSH PRIVILEGES ;

CREATE USER '@crafter_user'@'localhost'
	IDENTIFIED BY '@crafter_password' ;

GRANT ALL PRIVILEGES ON @crafter_schema_name.* TO '@crafter_user'@'localhost'
	WITH GRANT OPTION ;

CREATE USER '@crafter_user'@'%'
	IDENTIFIED BY '@crafter_password' ;

GRANT ALL PRIVILEGES ON @crafter_schema_name.* TO '@crafter_user'@'%'
	WITH GRANT OPTION ;
