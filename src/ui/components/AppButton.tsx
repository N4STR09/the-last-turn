import type { ButtonHTMLAttributes } from 'react';

export type AppButtonVariant = 'primary' | 'secondary' | 'quiet';

export interface AppButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement> {
  readonly variant?: AppButtonVariant;
}

export function AppButton({
  variant = 'primary',
  className,
  type = 'button',
  ...buttonProps
}: AppButtonProps) {
  const classes = ['button', `button--${variant}`, className]
    .filter((name): name is string => name !== undefined)
    .join(' ');

  return <button {...buttonProps} className={classes} type={type} />;
}
