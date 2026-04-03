import { csrfSync } from "csrf-sync";

export const {
  invalidCsrfTokenError, // This is just for convenience if you plan on making your own middleware.
  generateToken, // Use this in your routes to provide a CSRF hash + token to a request.
  getTokenFromRequest, // use this to retrieve the token submitted by a user
  getTokenFromState, // The default method for retrieving a token from state.
  storeTokenInState, // The default method for storing a token in state.
  revokeToken, // Revokes/deletes a token by calling storeTokenInState(undefined)
  csrfSynchronisedProtection, // This is the default CSRF protection middleware.
} = csrfSync({
  getTokenFromRequest: (req) => {
    return req.headers["x-csrf-token"];
  },
});