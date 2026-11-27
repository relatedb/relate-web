CREATE CONSTRAINT `language_name` FOR (n:`Language`) REQUIRE (n.`name`) IS UNIQUE;
CREATE CONSTRAINT `owner_login` FOR (n:`Owner`) REQUIRE (n.`login`) IS UNIQUE;
CREATE CONSTRAINT `project_full_name` FOR (n:`Project`) REQUIRE (n.`fullName`) IS UNIQUE;
CREATE CONSTRAINT `topic_name` FOR (n:`Topic`) REQUIRE (n.`name`) IS UNIQUE;
