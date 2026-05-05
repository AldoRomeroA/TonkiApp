import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

/** Botón circular compartido para enlaces externos a redes en landing / detalle. */
export const socialIconLinkClass =
  "inline-flex h-11 w-11 items-center justify-center rounded-full border border-tonki-border-strong bg-tonki-elevated/45 text-tonki-text-secondary transition-colors hover:border-tonki-accent hover:bg-tonki-accent/10 hover:text-tonki-accent";

/** Instagram camera outline (`stroke="currentColor"`). */
export function IconInstagram({ className, ...props }: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
      {...props}
    >
      <rect width={20} height={20} x={2} y={2} rx={5} ry={5} />
      <circle cx={12} cy={12} r={4} />
      <circle cx={17.5} cy={6.5} r={1} fill="currentColor" stroke="none" />
    </svg>
  );
}

/** Monochrome X (Twitter) glyph (fills with `currentColor`). */
export function IconX({ className, ...props }: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden
      {...props}
    >
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.685H5.117z" />
    </svg>
  );
}
