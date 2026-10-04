export interface AuthUser {
  displayName: string;
  email: string;
  roles: string[];
  scopes: string[];
  sub: string;
}

export interface RequestWithUser {
  log?: { setBindings?: (bindings: Record<string, unknown>) => void };
  user?: AuthUser;
}
