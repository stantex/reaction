import url from "url";
import Logger from "@reactioncommerce/logger";
import { execute, subscribe } from "graphql";
import { Accounts } from "meteor/accounts-base";
import { Meteor } from "meteor/meteor";
import { MongoInternals } from "meteor/mongo";
import { WebApp } from "meteor/webapp";
import { formatApolloErrors } from "apollo-server-errors";
import { SubscriptionServer } from "subscriptions-transport-ws";
import ReactionNodeApp from "/imports/node-app/core/ReactionNodeApp";
import { setBaseContext } from "/imports/plugins/core/graphql/server/getGraphQLContextInMeteorMethod";
import runMeteorMethodWithContext from "../util/runMeteorMethodWithContext";
import { setCollections } from "/imports/collections/rawCollections";
import meteorFileCollectionStartup from "/imports/plugins/core/files/server/fileCollections";
import packageJson from "/package.json";

// For Meteor app tests
let appStartupIsComplete = false;
export const isAppStartupComplete = () => appStartupIsComplete;

/**
 * @summary Starts the Reaction Node app within a Meteor server
 * @param {Function} [onAppInstanceCreated] Function to call with `app` after it is created
 * @returns {undefined}
 */
export default async function startNodeApp({ onAppInstanceCreated }) {
  const { ROOT_URL } = process.env;
  const mongodb = MongoInternals.NpmModules.mongodb.module;

  const app = new ReactionNodeApp({
    addCallMeteorMethod(context) {
      context.callMeteorMethod = (name, ...args) => runMeteorMethodWithContext(context, name, args);
    },
    // XXX Eventually these should be from individual env variables instead
    debug: Meteor.isDevelopment,
    context: {
      appVersion: packageJson.version,
      async createUser(options) {
        return Accounts.createUser(options);
      },
      mutations: {},
      queries: {},
      rootUrl: ROOT_URL
    },
    graphQL: {
      graphiql: Meteor.isDevelopment
    },
    httpServer: WebApp.httpServer,
    mongodb
  });

  // Wait for all plugins to register themselves
  if (onAppInstanceCreated) await onAppInstanceCreated(app);

  // Create the Apollo Server and Express instances
  app.initServer();

  // Inject the `Db` instance that Meteor has already created and connected
  const { db } = MongoInternals.defaultRemoteCollectionDriver().mongo;
  app.setMongoDatabase(db);

  // Set the base context used by getGraphQLContextInMeteorMethod, which ideally should be identical
  // to the one in GraphQL. Temporary during the Meteor transition.
  // Remove this after nothing uses `getGraphQLContextInMeteorMethod`.
  setBaseContext(app.context);

  // Run "registerPluginHandler", "preStartupCheck", and "startup" type functions
  let startupWasSuccessful;
  try {
    startupWasSuccessful = await app.runServiceStartup();
  } catch (error) {
    Logger.error(error, "Error running plugin startup");
    startupWasSuccessful = false;
  }

  // Set rawCollections. Temporary during the Meteor transition.
  // Remove this after nothing uses rawCollections.
  // Keep this after startup code in case additional collections
  // are being defined on startup.
  setCollections(app.context.collections);

  // Working on moving this into standard startup function pattern,
  // but currently there are a couple Meteor dependencies.
  if (startupWasSuccessful) {
    meteorFileCollectionStartup(app.context);
  }

  // Bind the specified paths to the Express server running GraphQL.
  // This is where we merge the Express server created by Apollo
  // into the one Meteor has already created.
  WebApp.connectHandlers.use(app.expressApp);

  // Generate upgrade handler which supports both Meteor socket and graphql.
  // See https://github.com/apollographql/subscriptions-transport-ws/issues/235
  // See https://github.com/DxCx/meteor-graphql-rxjs/commit/216856856e00e3f533e4ce39badd37f38274a4b8
  const { apolloServer, graphQLPath } = app;

  // If the dueling WebSockets issue is ever resolved, we should be able to
  // use the standard `installSubscriptionHandlers` call:
  // apolloServer.installSubscriptionHandlers(app.httpServer);
  //
  // But for now this is copied straight out of `installSubscriptionHandlers`
  // with WS options changed to `noServer: true`
  apolloServer.subscriptionServer = SubscriptionServer.create(
    {
      schema: apolloServer.schema,
      execute,
      subscribe,
      onOperation: async (message, connection) => {
        connection.formatResponse = (value) => ({
          ...value,
          errors:
            value.errors &&
            formatApolloErrors([...value.errors], {
              formatter: apolloServer.requestOptions.formatError,
              debug: apolloServer.requestOptions.debug
            })
        });

        let context;
        try {
          context = await apolloServer.context({ connection, payload: message.payload });
        } catch (error) {
          throw formatApolloErrors([error], {
            formatter: apolloServer.requestOptions.formatError,
            debug: apolloServer.requestOptions.debug
          })[0];
        }

        return { ...connection, context };
      }
    },
    {
      noServer: true
    }
  );

  const { wsServer } = apolloServer.subscriptionServer;
  WebApp.httpServer.on("upgrade", (req, socket, head) => {
    const { pathname } = url.parse(req.url);

    if (pathname === graphQLPath) {
      wsServer.handleUpgrade(req, socket, head, (ws) => {
        wsServer.emit("connection", ws, req);
      });
    } else if (pathname.startsWith("/sockjs")) {
      // Don't do anything, this is meteor socket.
    } else {
      socket.end();
    }
  });

  // Log to inform that the server is running
  WebApp.httpServer.on("listening", () => {
    Logger.info(`GraphQL listening at ${ROOT_URL}${app.apolloServer.graphqlPath}`);
    Logger.info(`GraphQL subscriptions ready at ${ROOT_URL.replace("http", "ws")}${app.apolloServer.subscriptionsPath}`);

    appStartupIsComplete = true;
  });
}
