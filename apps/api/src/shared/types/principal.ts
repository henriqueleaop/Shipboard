export interface Principal {
  readonly id: string;
  readonly email: string;
}

export function toPrincipal(user: { id: string; email: string }): Principal {
  return Object.freeze({ id: user.id, email: user.email });
}
