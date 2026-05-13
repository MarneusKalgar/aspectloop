export interface AuthUser {
  email: string;
  roles: string[];
  scopes: string[];
  sub: string;
}

/* eslint-disable-next-line */
export interface JwtPayload extends AuthUser {}

export interface RequestWithUser {
  log?: { setBindings?: (bindings: Record<string, unknown>) => void };
  user?: AuthUser;
}
