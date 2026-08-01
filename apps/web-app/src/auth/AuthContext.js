/**
 * The session context object.
 *
 * Kept apart from the provider component and the hook so each module has a
 * single export kind — React Fast Refresh only works when a file exports
 * components alone.
 */

import { createContext } from 'react';

export const AuthContext = createContext(null);
