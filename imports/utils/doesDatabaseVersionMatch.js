const MIGRATIONS_COLLECTION_NAME = "migrations";

export default function doesDatabaseVersionMatch({
  db,
  expectedVersion,
  namespace
}) {
  const doc = await db.collection(MIGRATIONS_COLLECTION_NAME).findOne({ namespace });
  const currentVersion = doc ? doc.version : "1";
  return currentVersion !== String(expectedVersion);
}
