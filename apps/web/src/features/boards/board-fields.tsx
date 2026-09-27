import type { UseFormReturn } from 'react-hook-form';
import React from 'react';

import type { CreateBoardRequest } from '@shipboard/contracts';

export function BoardFields({
  form,
}: {
  form: UseFormReturn<CreateBoardRequest>;
}) {
  return (
    <>
      <label htmlFor="board-name">Board name</label>
      <input id="board-name" {...form.register('name')} />
      {form.formState.errors.name && (
        <p role="alert" className="field-error">
          {form.formState.errors.name.message}
        </p>
      )}
      <label htmlFor="board-slug">Public slug</label>
      <input id="board-slug" autoCapitalize="none" {...form.register('slug')} />
      <p className="hint">Use lowercase letters, numbers and single hyphens.</p>
      {form.formState.errors.slug && (
        <p role="alert" className="field-error">
          {form.formState.errors.slug.message}
        </p>
      )}
      <label htmlFor="board-description">Description</label>
      <textarea
        id="board-description"
        rows={4}
        {...form.register('description')}
      />
      {form.formState.errors.description && (
        <p role="alert" className="field-error">
          {form.formState.errors.description.message}
        </p>
      )}
    </>
  );
}
