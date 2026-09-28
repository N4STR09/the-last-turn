import type { ComponentPropsWithRef } from 'react';

export type AppButtonVariant = 'primary' | 'secondary' | 'quiet' | 'danger';

export interface AppButtonProps extends ComponentPropsWithRef<'button'> {
  readonly variant?: AppButtonVariant;
}

/**
 * Botón base. En React 19 `ref` es una prop más, así que llega por el mismo
 * `...buttonProps` que el resto y no hace falta envolverlo en nada.
 */
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
