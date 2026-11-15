// The scenarios of the home page's live console (src/components/Console.astro): each seeds a small
// in-memory graph with Cypher statements, then offers queries to run on it. The seeds and queries
// come from the earlier site's console. Statements run one at a time on the engine in the browser.

export interface Demo {
  /** The suggestion chip. */
  name: string;
  query: string;
}

export interface Scenario {
  /** The status bar's label. */
  label: string;
  /** Lines printed under the banner when the scenario loads. */
  banner?: string[];
  /** Statements that load the dataset, in order. */
  seed: string[];
  demos: Demo[];
}

export const SCENARIOS: Record<string, Scenario> = {
  'analytics': {
    label: 'analytics · movies · 12 films · 5 raters',
    seed: [
      "CREATE CONSTRAINT movie_title IF NOT EXISTS FOR (m:Movie) REQUIRE m.title IS UNIQUE",
      "CREATE CONSTRAINT person_name IF NOT EXISTS FOR (p:Person) REQUIRE p.name IS UNIQUE",
      "CREATE CONSTRAINT genre_name IF NOT EXISTS FOR (g:Genre) REQUIRE g.name IS UNIQUE",
      "UNWIND ['Sci-Fi','Thriller','Drama','Crime','Action','Romance'] AS g CREATE (:Genre {name:g})",
      "UNWIND [" +
      "  {title:'Inception', year:2010, genres:['Sci-Fi','Thriller']}," +
      "  {title:'Interstellar', year:2014, genres:['Sci-Fi','Drama']}," +
      "  {title:'The Dark Knight', year:2008, genres:['Action','Crime','Drama']}," +
      "  {title:'The Prestige', year:2006, genres:['Drama','Thriller']}," +
      "  {title:'Memento', year:2000, genres:['Thriller','Drama']}," +
      "  {title:'Dunkirk', year:2017, genres:['Action','Drama']}," +
      "  {title:'Pulp Fiction', year:1994, genres:['Crime','Drama']}," +
      "  {title:'Kill Bill: Vol. 1', year:2003, genres:['Action','Crime']}," +
      "  {title:'Fight Club', year:1999, genres:['Drama','Thriller']}," +
      "  {title:'Se7en', year:1995, genres:['Crime','Thriller']}," +
      "  {title:'The Social Network', year:2010, genres:['Drama']}," +
      "  {title:'La La Land', year:2016, genres:['Romance','Drama']}" +
      "] AS m " +
      "CREATE (f:Movie {title:m.title, year:m.year}) " +
      "WITH f, m UNWIND m.genres AS gn MATCH (g:Genre {name:gn}) MERGE (f)-[:IN_GENRE]->(g)",
      "UNWIND [" +
      "  'Leonardo DiCaprio','Joseph Gordon-Levitt','Marion Cotillard','Matthew McConaughey'," +
      "  'Anne Hathaway','Jessica Chastain','Christian Bale','Heath Ledger','Hugh Jackman'," +
      "  'Guy Pearce','Fionn Whitehead','John Travolta','Uma Thurman','Samuel L. Jackson'," +
      "  'Brad Pitt','Edward Norton','Morgan Freeman','Jesse Eisenberg','Rooney Mara','Emma Stone','Ryan Gosling'," +
      "  'Christopher Nolan','Quentin Tarantino','David Fincher'" +
      "] AS n CREATE (:Person {name:n})",
      "UNWIND [" +
      "  ['Inception', ['Leonardo DiCaprio','Joseph Gordon-Levitt','Marion Cotillard']]," +
      "  ['Interstellar', ['Matthew McConaughey','Anne Hathaway','Jessica Chastain']]," +
      "  ['The Dark Knight', ['Christian Bale','Heath Ledger','Morgan Freeman']]," +
      "  ['The Prestige', ['Christian Bale','Hugh Jackman']]," +
      "  ['Memento', ['Guy Pearce']]," +
      "  ['Dunkirk', ['Fionn Whitehead']]," +
      "  ['Pulp Fiction', ['John Travolta','Uma Thurman','Samuel L. Jackson']]," +
      "  ['Kill Bill: Vol. 1', ['Uma Thurman']]," +
      "  ['Fight Club', ['Brad Pitt','Edward Norton']]," +
      "  ['Se7en', ['Brad Pitt','Morgan Freeman']]," +
      "  ['The Social Network', ['Jesse Eisenberg','Rooney Mara']]," +
      "  ['La La Land', ['Emma Stone','Ryan Gosling']]" +
      "] AS r " +
      "MATCH (m:Movie {title:r[0]}) " +
      "UNWIND r[1] AS actor MATCH (p:Person {name:actor}) MERGE (p)-[:ACTED_IN]->(m)",
      "UNWIND [" +
      "  ['Christopher Nolan', ['Inception','Interstellar','The Dark Knight','The Prestige','Memento','Dunkirk']]," +
      "  ['Quentin Tarantino', ['Pulp Fiction','Kill Bill: Vol. 1']]," +
      "  ['David Fincher', ['Fight Club','Se7en','The Social Network']]" +
      "] AS r " +
      "MATCH (d:Person {name:r[0]}) " +
      "UNWIND r[1] AS title MATCH (m:Movie {title:title}) MERGE (d)-[:DIRECTED]->(m)",
      "UNWIND ['Alex','Ben','Chloe','Dana','Erin'] AS u CREATE (:User {name:u})",
      "UNWIND [" +
      "  ['Alex','Inception',5], ['Alex','Interstellar',5], ['Alex','The Dark Knight',4]," +
      "  ['Alex','The Prestige',5], ['Alex','Memento',4]," +
      "  ['Ben','Inception',4], ['Ben','The Dark Knight',5], ['Ben','Pulp Fiction',5]," +
      "  ['Ben','Kill Bill: Vol. 1',4], ['Ben','Fight Club',5]," +
      "  ['Chloe','La La Land',5], ['Chloe','The Social Network',4], ['Chloe','Inception',3]," +
      "  ['Chloe','The Prestige',4]," +
      "  ['Dana','Se7en',5], ['Dana','Fight Club',5], ['Dana','Pulp Fiction',4]," +
      "  ['Dana','The Dark Knight',4], ['Dana','Memento',5]," +
      "  ['Erin','Interstellar',5], ['Erin','Dunkirk',4], ['Erin','The Dark Knight',5]," +
      "  ['Erin','The Prestige',5], ['Erin','Inception',4]" +
      "] AS r " +
      "MATCH (u:User {name:r[0]}), (m:Movie {title:r[1]}) MERGE (u)-[:RATED {score:r[2]}]->(m)",
    ],
    demos: [
      { name: 'schema',
        query: 'CALL db.schema.visualization()' },
      { name: 'full graph',
        query: 'MATCH (n) WITH n OPTIONAL MATCH (n)-[r]-(m) RETURN n, r, m' },
      { name: 'co-stars of Christian Bale',
        query:
          "MATCH p = (:Person {name:'Christian Bale'})-[:ACTED_IN]->(:Movie)<-[:ACTED_IN]-(:Person)\n" +
          "RETURN p" },
      { name: "recommend for Chloe",
        query:
          "MATCH (chloe:User {name:'Chloe'})-[r1:RATED]->(seen:Movie)\n" +
          "WHERE r1.score >= 4\n" +
          "MATCH (seen)<-[r2:RATED]-(peer:User)-[r3:RATED]->(rec:Movie)\n" +
          "WHERE peer <> chloe AND r2.score >= 4 AND r3.score >= 4\n" +
          "  AND NOT EXISTS { (chloe)-[:RATED]->(rec) }\n" +
          "RETURN rec.title AS movie, count(DISTINCT peer) AS endorsers,\n" +
          "       round(avg(r3.score)*10)/10 AS peerScore\n" +
          "ORDER BY endorsers DESC, peerScore DESC LIMIT 5" },
      { name: 'directors ranked by audience score',
        query:
          "MATCH (d:Person)-[:DIRECTED]->(m:Movie)<-[r:RATED]-(:User)\n" +
          "RETURN d.name AS director, count(DISTINCT m) AS films,\n" +
          "       count(r) AS ratings, round(avg(r.score)*10)/10 AS avgScore\n" +
          "ORDER BY avgScore DESC" },
    ],
  },

  'agent-memory': {
    label: 'agent-memory · 3 sessions · supersedes',
    seed: [
      "CREATE CONSTRAINT entity_key IF NOT EXISTS FOR (e:Entity) REQUIRE e.key IS UNIQUE",
      "CREATE CONSTRAINT session_id IF NOT EXISTS FOR (s:Session) REQUIRE s.id IS UNIQUE",
      // Sessions
      "UNWIND [" +
      "  {id:'s1', at:'2026-02-10T09:00:00Z'}," +
      "  {id:'s2', at:'2026-03-04T14:00:00Z'}," +
      "  {id:'s3', at:'2026-05-20T10:00:00Z'}" +
      "] AS s CREATE (:Session {id:s.id, name:'session ' + s.id, startedAt:datetime(s.at)})",
      // Messages (seq is global so slot-supersede logic is simple)
      "UNWIND [" +
      "  {sid:'s1', seq:1,  at:'2026-02-10T09:05:00Z', text:'Standing up an orders service, Priya will own it.'}," +
      "  {sid:'s1', seq:2,  at:'2026-02-10T09:10:00Z', text:'We will use Postgres for the orders store.'}," +
      "  {sid:'s1', seq:3,  at:'2026-02-10T09:20:00Z', text:'Checkout and payments both depend on orders.'}," +
      "  {sid:'s1', seq:4,  at:'2026-02-10T09:25:00Z', text:'Target p99 under 150ms for the orders API.'}," +
      "  {sid:'s2', seq:11, at:'2026-03-04T14:05:00Z', text:'Priya moved teams; Mateo is now the orders owner.'}," +
      "  {sid:'s2', seq:12, at:'2026-03-04T14:15:00Z', text:'We switched orders to CockroachDB for multi-region.'}," +
      "  {sid:'s2', seq:13, at:'2026-03-04T14:25:00Z', text:'Shipping became a new consumer of orders.'}," +
      "  {sid:'s3', seq:21, at:'2026-05-20T10:05:00Z', text:'Jun takes over the orders service as Mateo rotates off.'}," +
      "  {sid:'s3', seq:22, at:'2026-05-20T10:15:00Z', text:'New p99 target: under 120ms after the index rework.'}" +
      "] AS msg " +
      "MATCH (s:Session {id:msg.sid}) " +
      "CREATE (:Message {seq:msg.seq, name:'msg ' + msg.seq, text:msg.text, at:datetime(msg.at)})-[:IN_SESSION]->(s)",
      // Entities
      "UNWIND [" +
      "  {name:'orders service',kind:'Service'}, {name:'checkout',kind:'Service'}," +
      "  {name:'payments',kind:'Service'},      {name:'shipping',kind:'Service'}," +
      "  {name:'Priya',kind:'Person'},          {name:'Mateo',kind:'Person'}," +
      "  {name:'Jun',kind:'Person'},            {name:'Postgres',kind:'Technology'}," +
      "  {name:'CockroachDB',kind:'Technology'}" +
      "] AS e MERGE (:Entity {key:toLower(e.name), name:e.name, kind:e.kind})",
      // Message → Entity mentions
      "UNWIND [" +
      "  [1,['orders service','Priya']]," +
      "  [2,['orders service','Postgres']]," +
      "  [3,['checkout','payments','orders service']]," +
      "  [4,['orders service']]," +
      "  [11,['Mateo','orders service','Priya']]," +
      "  [12,['orders service','CockroachDB']]," +
      "  [13,['shipping','orders service']]," +
      "  [21,['Jun','orders service','Mateo']]," +
      "  [22,['orders service']]" +
      "] AS r " +
      "MATCH (m:Message {seq:r[0]}) " +
      "UNWIND r[1] AS name MATCH (e:Entity {key:toLower(name)}) MERGE (m)-[:MENTIONS]->(e)",
      // Facts
      "UNWIND [" +
      "  {seq:1,  text:'Priya owns the orders service',     slot:'orders service/owner',    about:['orders service','Priya']}," +
      "  {seq:3,  text:'checkout depends on orders service',slot:'checkout/depends',        about:['checkout','orders service']}," +
      "  {seq:3,  text:'payments depends on orders service',slot:'payments/depends',        about:['payments','orders service']}," +
      "  {seq:11, text:'Mateo owns the orders service',     slot:'orders service/owner',    about:['orders service','Mateo']}," +
      "  {seq:13, text:'shipping depends on orders service',slot:'shipping/depends',        about:['shipping','orders service']}," +
      "  {seq:21, text:'Jun owns the orders service',       slot:'orders service/owner',    about:['orders service','Jun']}" +
      "] AS f " +
      "MATCH (m:Message {seq:f.seq}) " +
      "CREATE (x:Fact {name:f.text, text:f.text, slot:f.slot, seq:m.seq, at:m.at})-[:FROM]->(m) " +
      "WITH x, f UNWIND f.about AS name MATCH (e:Entity {key:toLower(name)}) MERGE (x)-[:ABOUT]->(e)",
      // Decisions
      "UNWIND [" +
      "  {seq:2,  text:'orders service persists to Postgres',    rationale:'team already runs Postgres',   slot:'orders service/database', about:['orders service','Postgres']}," +
      "  {seq:4,  text:'orders API p99 target is 150ms',          rationale:'checkout SLO',                 slot:'orders service/p99',      about:['orders service']}," +
      "  {seq:12, text:'orders service persists to CockroachDB',  rationale:'multi-region writes',          slot:'orders service/database', about:['orders service','CockroachDB']}," +
      "  {seq:22, text:'orders API p99 target is 120ms',          rationale:'after the index rework',       slot:'orders service/p99',      about:['orders service']}" +
      "] AS d " +
      "MATCH (m:Message {seq:d.seq}) " +
      "CREATE (x:Decision {name:d.text, text:d.text, rationale:d.rationale, slot:d.slot, seq:m.seq, at:m.at})-[:FROM]->(m) " +
      "WITH x, d UNWIND d.about AS name MATCH (e:Entity {key:toLower(name)}) MERGE (x)-[:ABOUT]->(e)",
      // Supersede: for every slot, every newer item replaces the one immediately before it.
      "MATCH (newer:Fact), (older:Fact) " +
      "WHERE newer.slot = older.slot AND newer.seq > older.seq " +
      "  AND NOT EXISTS { MATCH (mid:Fact {slot:newer.slot}) WHERE mid.seq > older.seq AND mid.seq < newer.seq } " +
      "SET older.supersededAt = newer.at " +
      "MERGE (newer)-[:SUPERSEDES]->(older)",
      "MATCH (newer:Decision), (older:Decision) " +
      "WHERE newer.slot = older.slot AND newer.seq > older.seq " +
      "  AND NOT EXISTS { MATCH (mid:Decision {slot:newer.slot}) WHERE mid.seq > older.seq AND mid.seq < newer.seq } " +
      "SET older.supersededAt = newer.at " +
      "MERGE (newer)-[:SUPERSEDES]->(older)",
    ],
    demos: [
      { name: 'schema',
        query: 'CALL db.schema.visualization()' },
      { name: 'full graph',
        query: 'MATCH (n) WITH n OPTIONAL MATCH (n)-[r]-(m) RETURN n, r, m' },
      { name: 'orders ownership chain',
        query:
          "MATCH p = (f:Fact {slot:'orders service/owner'})-[:SUPERSEDES*0..]->(:Fact)\n" +
          "RETURN p" },
      { name: 'current state of the orders service',
        query:
          "MATCH (e:Entity {key:'orders service'})<-[:ABOUT]-(x)\n" +
          "WHERE x.supersededAt IS NULL\n" +
          "RETURN labels(x)[0] AS kind, x.slot AS slot, x.text AS statement,\n" +
          "       x.at AS asOf\n" +
          "ORDER BY kind, slot" },
      { name: 'ownership timeline',
        query:
          "MATCH (f:Fact {slot:'orders service/owner'})\n" +
          "RETURN f.text AS statement, f.at AS from,\n" +
          "       coalesce(toString(f.supersededAt), 'current') AS until\n" +
          "ORDER BY f.seq" },
    ],
  },

  'codebase': {
    label: 'codebase · 10 crates · 9 ADRs',
    banner: [
      'A slice of the Relate codebase: 10 crates and 9 ADRs.',
      'Crates depend on crates; ADRs supersede ADRs; crates cite ADRs.',
    ],
    seed: [
      "CREATE CONSTRAINT crate_name IF NOT EXISTS FOR (c:Crate) REQUIRE c.name IS UNIQUE",
      "CREATE CONSTRAINT adr_number IF NOT EXISTS FOR (a:ADR) REQUIRE a.number IS UNIQUE",
      "UNWIND [" +
      "  {name:'relate', desc:'public Rust API — Database::open'}," +
      "  {name:'relate-parser', desc:'Cypher lexer, parser, AST'}," +
      "  {name:'relate-front', desc:'lower parser AST to planner IR'}," +
      "  {name:'relate-planner', desc:'bind + logical plan'}," +
      "  {name:'relate-executor', desc:'physical execution + in-memory graph'}," +
      "  {name:'relate-storage', desc:'VFS + WAL + snapshot codecs'}," +
      "  {name:'relate-catalog', desc:'labels, rel types, property keys'}," +
      "  {name:'relate-cli', desc:'relate shell'}," +
      "  {name:'relate-bolt', desc:'Bolt server'}," +
      "  {name:'relate-wasm', desc:'browser bindings (wasm-bindgen)'}" +
      "] AS r CREATE (:Crate {name:r.name, description:r.desc})",
      "UNWIND [" +
      "  ['relate','relate-parser'], ['relate','relate-front']," +
      "  ['relate','relate-planner'], ['relate','relate-executor']," +
      "  ['relate','relate-storage'], ['relate','relate-catalog']," +
      "  ['relate-front','relate-parser'], ['relate-front','relate-planner']," +
      "  ['relate-planner','relate-catalog'], ['relate-executor','relate-storage']," +
      "  ['relate-executor','relate-catalog'], ['relate-executor','relate-planner']," +
      "  ['relate-cli','relate'], ['relate-bolt','relate']," +
      "  ['relate-wasm','relate']" +
      "] AS d MATCH (a:Crate {name:d[0]}), (b:Crate {name:d[1]}) MERGE (a)-[:DEPENDS_ON]->(b)",
      "UNWIND [" +
      "  {num:'0046', title:'relate-front replaces planner-IR parser', status:'Accepted'}," +
      "  {num:'0057', title:'Bolt is a transport, not Neo4j feature parity', status:'Accepted'}," +
      "  {num:'0070', title:'Baseline loadtests run in a fixed container', status:'Accepted'}," +
      "  {num:'0071', title:'Baseline envelopes are CI-owned', status:'Accepted'}," +
      "  {num:'0080', title:'relate-load pulls Neo4j subgraphs via Query API v2', status:'Accepted'}," +
      "  {num:'0103', title:'Three top-level groups: relate / surfaces / testing', status:'Accepted'}," +
      "  {num:'0116', title:'Three fixed namespaces per store', status:'Accepted'}," +
      "  {num:'0119', title:'Remove 24 Enterprise multi-db CIP scenarios from frozen set', status:'Accepted'}," +
      "  {num:'0012', title:'Legacy single-parser plan (superseded)', status:'Superseded'}" +
      "] AS a CREATE (:ADR {number:a.num, title:a.title, status:a.status})",
      "MATCH (newer:ADR {number:'0046'}), (older:ADR {number:'0012'}) MERGE (newer)-[:SUPERSEDES]->(older)",
      "UNWIND [" +
      "  ['relate-front','0046'], ['relate-parser','0046']," +
      "  ['relate-bolt','0057'], ['relate-storage','0070']," +
      "  ['relate-storage','0071'], ['relate-cli','0080']," +
      "  ['relate','0103'], ['relate','0116']" +
      "] AS c MATCH (k:Crate {name:c[0]}), (a:ADR {number:c[1]}) MERGE (k)-[:CITES]->(a)",
    ],
    demos: [
      { name: 'schema',
        query: 'CALL db.schema.visualization()' },
      { name: 'full graph',
        query: 'MATCH (n) WITH n OPTIONAL MATCH (n)-[r]-(m) RETURN n, r, m' },
      { name: 'which crates depend on the parser?',
        query:
          "MATCH p = (c:Crate)-[:DEPENDS_ON*1..3]->(:Crate {name:'relate-parser'})\n" +
          "RETURN p" },
      { name: 'blast radius if the parser changes',
        query:
          "MATCH (p:Crate {name:'relate-parser'})<-[:DEPENDS_ON*1..5]-(dependent:Crate)\n" +
          "RETURN DISTINCT dependent.name AS crate, dependent.description AS what\n" +
          "ORDER BY crate" },
      { name: 'crate footprint (transitive deps)',
        query:
          "MATCH (c:Crate)\n" +
          "OPTIONAL MATCH (c)-[:DEPENDS_ON*1..5]->(d:Crate)\n" +
          "RETURN c.name AS crate,\n" +
          "       count(DISTINCT d) AS transitiveDeps,\n" +
          "       count { (c)-[:DEPENDS_ON]->(:Crate) } AS directDeps,\n" +
          "       count { (c)-[:CITES]->(:ADR) } AS citedADRs\n" +
          "ORDER BY transitiveDeps DESC, crate" },
    ],
  },

  'deps': {
    label: 'dependencies · 2 packages · 7 advisories',
    banner: [
      'Resolved dependency graph for two npm packages, with advisories.',
      'Shaped like the deps.dev output in the cookbook; small enough to see.',
    ],
    seed: [
      "CREATE CONSTRAINT version_key IF NOT EXISTS FOR (v:Version) REQUIRE v.key IS UNIQUE",
      "CREATE CONSTRAINT advisory_id IF NOT EXISTS FOR (a:Advisory) REQUIRE a.id IS UNIQUE",
      "UNWIND [" +
      "  {key:'npm/express@4.17.1', name:'express', version:'4.17.1', root:true}," +
      "  {key:'npm/body-parser@1.19.0', name:'body-parser', version:'1.19.0'}," +
      "  {key:'npm/qs@6.7.0', name:'qs', version:'6.7.0'}," +
      "  {key:'npm/debug@2.6.9', name:'debug', version:'2.6.9'}," +
      "  {key:'npm/ms@2.0.0', name:'ms', version:'2.0.0'}," +
      "  {key:'npm/accepts@1.3.7', name:'accepts', version:'1.3.7'}," +
      "  {key:'npm/mime-types@2.1.24', name:'mime-types', version:'2.1.24'}," +
      "  {key:'npm/cookie@0.4.0', name:'cookie', version:'0.4.0'}," +
      "  {key:'npm/jsonwebtoken@8.5.1', name:'jsonwebtoken', version:'8.5.1', root:true}," +
      "  {key:'npm/jws@3.2.2', name:'jws', version:'3.2.2'}," +
      "  {key:'npm/lodash@4.17.11', name:'lodash', version:'4.17.11'}," +
      "  {key:'npm/semver@5.6.0', name:'semver', version:'5.6.0'}" +
      "] AS v " +
      "CREATE (n:Version {key:v.key, name:v.name, version:v.version}) " +
      "FOREACH (_ IN CASE WHEN v.root THEN [1] ELSE [] END | SET n:Root)",
      "UNWIND [" +
      "  ['npm/express@4.17.1','npm/body-parser@1.19.0']," +
      "  ['npm/express@4.17.1','npm/qs@6.7.0']," +
      "  ['npm/express@4.17.1','npm/debug@2.6.9']," +
      "  ['npm/express@4.17.1','npm/accepts@1.3.7']," +
      "  ['npm/express@4.17.1','npm/cookie@0.4.0']," +
      "  ['npm/body-parser@1.19.0','npm/debug@2.6.9']," +
      "  ['npm/body-parser@1.19.0','npm/qs@6.7.0']," +
      "  ['npm/debug@2.6.9','npm/ms@2.0.0']," +
      "  ['npm/accepts@1.3.7','npm/mime-types@2.1.24']," +
      "  ['npm/jsonwebtoken@8.5.1','npm/jws@3.2.2']," +
      "  ['npm/jsonwebtoken@8.5.1','npm/lodash@4.17.11']," +
      "  ['npm/jsonwebtoken@8.5.1','npm/semver@5.6.0']," +
      "  ['npm/jws@3.2.2','npm/lodash@4.17.11']" +
      "] AS d MATCH (a:Version {key:d[0]}), (b:Version {key:d[1]}) MERGE (a)-[:DEPENDS_ON]->(b)",
      "UNWIND [" +
      "  {id:'GHSA-hrpp-h998-j3pp', title:'qs prototype pollution', cvss:7.5}," +
      "  {id:'GHSA-p8p7-x288-28g6', title:'lodash prototype pollution', cvss:7.4}," +
      "  {id:'GHSA-29mw-wpgm-hmr9', title:'lodash command injection', cvss:7.2}," +
      "  {id:'GHSA-c4w7-xm78-47vh', title:'semver ReDoS', cvss:5.3}," +
      "  {id:'GHSA-pxg6-pf52-xh8x', title:'cookie range', cvss:4.3}," +
      "  {id:'GHSA-rvg8-pwq2-xj7q', title:'body-parser DoS', cvss:7.5}," +
      "  {id:'GHSA-9wv6-86v2-598j', title:'express redirect', cvss:6.1}" +
      "] AS a CREATE (:Advisory {id:a.id, title:a.title, cvss3:a.cvss})",
      "UNWIND [" +
      "  ['npm/qs@6.7.0','GHSA-hrpp-h998-j3pp']," +
      "  ['npm/lodash@4.17.11','GHSA-p8p7-x288-28g6']," +
      "  ['npm/lodash@4.17.11','GHSA-29mw-wpgm-hmr9']," +
      "  ['npm/semver@5.6.0','GHSA-c4w7-xm78-47vh']," +
      "  ['npm/cookie@0.4.0','GHSA-pxg6-pf52-xh8x']," +
      "  ['npm/body-parser@1.19.0','GHSA-rvg8-pwq2-xj7q']," +
      "  ['npm/express@4.17.1','GHSA-9wv6-86v2-598j']" +
      "] AS r MATCH (v:Version {key:r[0]}), (a:Advisory {id:r[1]}) MERGE (v)-[:AFFECTED_BY]->(a)",
    ],
    demos: [
      { name: 'the resolved graph',
        query: 'MATCH (n) WITH n LIMIT 80 OPTIONAL MATCH (n)-[r]-(m) RETURN n, r, m' },
      { name: 'advisories express can reach',
        query:
          "MATCH p = (:Version:Root {name:'express'})-[:DEPENDS_ON*0..5]->(v:Version)-[:AFFECTED_BY]->(a:Advisory)\n" +
          "RETURN p" },
      { name: 'rank each root by worst advisory it reaches',
        query:
          "MATCH (root:Root)-[:DEPENDS_ON*0..5]->(v:Version)-[:AFFECTED_BY]->(a:Advisory)\n" +
          "RETURN root.name AS package, count(DISTINCT a) AS advisories,\n" +
          "       max(a.cvss3) AS worstCvss\n" +
          "ORDER BY worstCvss DESC" },
      { name: 'what goes if we drop jsonwebtoken?',
        query:
          "MATCH (root:Version:Root {name:'jsonwebtoken'})-[:DEPENDS_ON*1..5]->(v:Version)\n" +
          "WITH collect(DISTINCT v) AS reachable\n" +
          "UNWIND reachable AS v\n" +
          "WITH v WHERE NOT EXISTS {\n" +
          "  MATCH (r:Root)-[:DEPENDS_ON*0..5]->(v)\n" +
          "  WHERE r.name <> 'jsonwebtoken'\n" +
          "}\n" +
          "RETURN v.name AS gone, v.version AS version ORDER BY gone" },
      { name: 'shortest chain to the worst advisory',
        query:
          "MATCH (root:Root)-[:DEPENDS_ON*0..5]->(v:Version)-[:AFFECTED_BY]->(a:Advisory)\n" +
          "WITH a ORDER BY a.cvss3 DESC LIMIT 1\n" +
          "MATCH p = SHORTEST 1 (root:Root)-[:DEPENDS_ON*0..5]->(v:Version)-[:AFFECTED_BY]->(a)\n" +
          "RETURN p" },
    ],
  },
};
