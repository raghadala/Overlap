interface Requirement {
  label: string;
  test: (password: string) => boolean;
}

const REQUIREMENTS: Requirement[] = [
  { label: 'At least 8 characters', test: (p) => p.length >= 8 },
  { label: 'One uppercase letter', test: (p) => /[A-Z]/.test(p) },
  { label: 'One number', test: (p) => /\d/.test(p) },
  { label: 'One special character', test: (p) => /[^A-Za-z0-9]/.test(p) },
];

export function passwordMeetsRequirements(password: string): boolean {
  return REQUIREMENTS.every((req) => req.test(password));
}

export default function PasswordChecklist({ password, show }: { password: string; show: boolean }) {
  if (!show) return null;

  return (
    <ul className="password-checklist">
      {REQUIREMENTS.map((req) => {
        const met = req.test(password);
        return (
          <li key={req.label}>
            <span className={met ? 'check-icon met' : 'check-icon unmet'}>{met ? '✓' : '✗'}</span>
            {req.label}
          </li>
        );
      })}
    </ul>
  );
}