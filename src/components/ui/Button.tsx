import type { ButtonHTMLAttributes, AnchorHTMLAttributes, ReactNode } from 'react';

const base =
  'inline-flex items-center justify-center gap-2 rounded-full font-bold text-sm px-5 py-2.5 tracking-tight transition-all duration-150 active:scale-95 disabled:opacity-50 disabled:pointer-events-none focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2';

const variants = {
  primary: 'bg-accent text-[#181310] hover:bg-accent-hover shadow-[0_0_0_0_rgba(16,185,129,0)] hover:shadow-[0_6px_20px_-6px_rgba(16,185,129,0.6)]',
  ghost: 'bg-transparent text-text-primary border border-border hover:border-accent hover:text-accent',
};

type Variant = keyof typeof variants;

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  children: ReactNode;
}

export function Button({ variant = 'primary', className = '', children, ...props }: ButtonProps) {
  return (
    <button className={`${base} ${variants[variant]} ${className}`} {...props}>
      {children}
    </button>
  );
}

interface LinkButtonProps extends AnchorHTMLAttributes<HTMLAnchorElement> {
  variant?: Variant;
  children: ReactNode;
}

export function LinkButton({ variant = 'primary', className = '', children, ...props }: LinkButtonProps) {
  return (
    <a className={`${base} ${variants[variant]} ${className}`} {...props}>
      {children}
    </a>
  );
}
