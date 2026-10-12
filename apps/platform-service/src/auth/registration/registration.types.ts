export interface RegistrationIdentity {
  displayName: string;
  email: string;
  passwordHash: string;
}

export interface RegistrationMailWork {
  rawToken: string;
  to: string;
}
