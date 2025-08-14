import { ApolloClient, InMemoryCache } from '@apollo/client';

// In a real application, this URI would come from an environment variable.
// For local development, if running on an Android emulator, this would be http://10.0.2.2:3000/graphql
// For web or iOS simulator, it would be http://localhost:3000/graphql
const client = new ApolloClient({
  uri: 'http://localhost:3000/graphql',
  cache: new InMemoryCache(),
});

export default client;
