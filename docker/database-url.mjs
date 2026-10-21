const { DATABASE_URL, POSTGRES_PASSWORD } = process.env;
if (DATABASE_URL) {
  console.log(DATABASE_URL);
} else {
  if (!POSTGRES_PASSWORD) throw new Error("POSTGRES_PASSWORD or DATABASE_URL is required");
  console.log(`postgresql://textverktyg:${encodeURIComponent(POSTGRES_PASSWORD)}@postgres:5432/textverktyg`);
}
