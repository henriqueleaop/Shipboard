'use client';

import React, { useRef, useState, type InputHTMLAttributes } from 'react';
import { Input } from './input';
import { useLocale } from '../../lib/i18n/provider';

export const PasswordInput = React.forwardRef<
  HTMLInputElement,
  InputHTMLAttributes<HTMLInputElement> & { confirmation?: boolean }
>(({ confirmation = false, ...props }, forwardedRef) => {
  const { t } = useLocale();
  const input = useRef<HTMLInputElement>(null);
  const [visible, setVisible] = useState(false);
  const label = confirmation
    ? visible
      ? t('Hide confirmation')
      : t('Show confirmation')
    : visible
      ? t('Hide password')
      : t('Show password');
  return (
    <div className="password-field">
      <Input
        {...props}
        type={visible ? 'text' : 'password'}
        ref={(element) => {
          input.current = element;
          if (typeof forwardedRef === 'function') forwardedRef(element);
          else if (forwardedRef) forwardedRef.current = element;
        }}
      />
      <button
        className="password-toggle"
        type="button"
        aria-label={label}
        title={label}
        aria-pressed={visible}
        onPointerDown={(event) => event.preventDefault()}
        onClick={() => {
          const start = input.current?.selectionStart;
          const end = input.current?.selectionEnd;
          setVisible((value) => !value);
          requestAnimationFrame(() => {
            if (
              start !== null &&
              start !== undefined &&
              end !== null &&
              end !== undefined
            )
              input.current?.setSelectionRange(start, end);
          });
        }}
      >
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.7"
          aria-hidden="true"
        >
          <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
          <circle cx="12" cy="12" r="3" />
          {visible && <path d="m3 3 18 18" />}
        </svg>
      </button>
    </div>
  );
});
PasswordInput.displayName = 'PasswordInput';
