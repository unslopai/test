interface StatusBadgeProps {
  readonly label: string;
  readonly tone: 'ok' | 'warning' | 'error';
}

const TONE_CLASSES: Record<StatusBadgeProps['tone'], string> = {
  ok: 'badge badge-ok',
  warning: 'badge badge-warning',
  error: 'badge badge-error',
};

export function StatusBadge({ label, tone }: StatusBadgeProps) {
  return <span className={TONE_CLASSES[tone]}>{label}</span>;
}
