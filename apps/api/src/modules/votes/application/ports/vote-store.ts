export interface VoteState {
  suggestionId: string;
  voted: boolean;
  voteCount: number;
}

export interface VoteStore {
  change(
    suggestionId: string,
    userId: string,
    voted: boolean,
  ): Promise<{ state: VoteState; changed: boolean } | null>;
  state(suggestionId: string, userId: string): Promise<VoteState | null>;
  myVotes(
    boardId: string,
    suggestionIds: string[],
    userId: string,
  ): Promise<{ suggestionId: string; voted: boolean }[]>;
  boardActive(id: string): Promise<boolean>;
}
