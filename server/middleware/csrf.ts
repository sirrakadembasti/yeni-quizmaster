import { csrfSync } from "csrf-sync";

const sync = csrfSync({
  getTokenFromRequest: (req) => {
    const token = req.headers["x-csrf-token"];
    return Array.isArray(token) ? token[0] : token;
  },
});

export const generateToken = sync.generateToken;
export const csrfSynchronisedProtection = sync.csrfSynchronisedProtection;
export const getTokenFromRequest = sync.getTokenFromRequest;
export const getTokenFromState = sync.getTokenFromState;
export const storeTokenInState = sync.storeTokenInState;
export const revokeToken = sync.revokeToken;