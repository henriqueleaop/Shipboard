export type ProfileErrorCode = 'PROFILE_NOT_FOUND' | 'USERNAME_CONFLICT';

export class ProfileError extends Error {
  constructor(readonly code: ProfileErrorCode) {
    super(code);
  }
}
