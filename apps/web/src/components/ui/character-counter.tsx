import React from 'react';

export function CharacterCounter({
  id,
  value,
  limit,
}: {
  id: string;
  value: string;
  limit: number;
}) {
  return (
    <p id={id} className="character-counter" aria-live="polite">
      {value.length} / {limit}
    </p>
  );
}
