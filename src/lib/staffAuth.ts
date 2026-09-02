/** Staff accounts sign in with a short id + password rather than a real
 *  email address. Supabase auth still needs an email-shaped value, so ids
 *  are silently mapped to `<id>@apexbadminton.example` under the hood. A
 *  value that already looks like an email (has an "@") is used as-is. */
export const STAFF_EMAIL_DOMAIN = 'apexbadminton.example';

export function toStaffEmail(idOrEmail: string): string {
  const trimmed = idOrEmail.trim().toLowerCase();
  if (!trimmed || trimmed.includes('@')) return trimmed;
  return `${trimmed}@${STAFF_EMAIL_DOMAIN}`;
}

export function staffIdFromEmail(email: string): string {
  const suffix = `@${STAFF_EMAIL_DOMAIN}`;
  return email.endsWith(suffix) ? email.slice(0, -suffix.length) : email;
}
