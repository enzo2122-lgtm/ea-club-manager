/* The EA Club Manager server (Supabase), shared by every club and built into the app.
   The key is the « publishable » key, made to be public: the tables are closed and every SQL function
   finds the club of the person (login or invitation code) before giving anything — see supabase/ea-schema.sql. */
const CLUB_SERVER = {
  url: '', // https://xxxx.supabase.co : the EA Club Manager project (not the one of a club)
  key: '', // sb_publishable_…
};
