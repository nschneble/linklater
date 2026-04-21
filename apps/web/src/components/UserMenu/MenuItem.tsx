interface MenuItemProps {
  icon: string;
  label: string;
  onClick: () => void;
  active?: boolean;
  className?: string;
}

export default function MenuItem({
  icon,
  label,
  onClick,
  active = false,
  className = '',
}: MenuItemProps) {
  return (
    <button
      className={`flex items-center gap-2 w-full px-3 py-2 hover:bg-[var(--bg-surface)] text-[var(--text)] text-left cursor-pointer ${className}`}
      type="button"
      onClick={onClick}
    >
      <i
        className={`fa-solid ${icon} text-[0.75rem] ${
          active ? 'text-[var(--accent)]' : 'text-[var(--text-muted)]'
        }`}
      />
      <span>{label}</span>
    </button>
  );
}
