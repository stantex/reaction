import doesDatabaseVersionMatch from "/imports/utils/doesDatabaseVersionMatch";

/**
 * @summary Called before startup to check if we can start
 * @param {Object} context Startup context
 * @param {Object} context.collections Map of MongoDB collections
 * @returns {String[]} Array of error messages. Empty if all checks pass.
 */
export default async function preStartupCheck(context) {
  const ok = await doesDatabaseVersionMatch({
    db: context.app.db,
    expectedVersion: 2,
    namespace: "reaction-plugin-test"
  });

  if (!ok) {
    return ['Database needs migrating. The "reaction-plugin-test" namespace must be at version 2 to continue.'];
  }

  return [];
}
