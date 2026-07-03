import React from 'react';

/**
 * SafeLink — renders a markdown <a> tag but strips dangerous URL protocols
 * (javascript:, data:, vbscript:, etc.). Used with react-markdown's
 * `components` prop to prevent stored XSS via compromised teacher accounts.
 *
 * Only http:, https:, mailto:, #fragments, and root-relative paths pass through.
 */
export function SafeLink({
  href,
  children,
  ...rest
}: React.AnchorHTMLAttributes<HTMLAnchorElement>) {
  const safe = typeof href === 'string' && /^(https?:|mailto:|#|\/)/.test(href);
  if (!safe) return <span>{children}</span>;
  return (
    <a href={href} rel="noopener noreferrer" target="_blank" {...rest}>
      {children}
    </a>
  );
}
