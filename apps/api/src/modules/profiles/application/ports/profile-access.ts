export interface CurrentProfile {
  id: string;
  email: string;
  username: string;
  githubProfileUrl: string | null;
}

export interface PublicProfileBoard {
  name: string;
  slug: string;
  description: string;
}

export interface PublicProfile {
  username: string;
  githubProfileUrl: string | null;
  boards: PublicProfileBoard[];
  nextCursor: ProfileCursor | null;
}

export interface ProfileCursor {
  createdAt: Date;
  id: string;
}

export interface ProfileAccess {
  current(userId: string, email: string): Promise<CurrentProfile>;
  updateUsername(userId: string, username: string): Promise<CurrentProfile>;
  publicByUsername(
    username: string,
    limit: number,
    cursor?: ProfileCursor,
  ): Promise<PublicProfile | null>;
}
