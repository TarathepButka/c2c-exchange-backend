export type AuthenticatedUser = {
  id: string;
  email: string;
  jti?: string;
  tokenExpiresAt?: Date;
  permissions?: string[];
};
