import type { MaterialId } from '../game/types';

export function MaterialIcon({
  material,
  className = 'w-4 h-4',
}: {
  material: MaterialId;
  className?: string;
}) {
  if (material === 'shadow_iron') {
    return (
      <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
        <path
          d="M4 17L7 7L14 4L20 10L18 18L4 17Z"
          fill="#64748b"
          stroke="#0e0c14"
          strokeWidth="2"
          strokeLinejoin="round"
        />
        <path d="M9 11L14 7L16 13L11 15Z" fill="#cbd5e1" />
      </svg>
    );
  }
  if (material === 'rift_shard') {
    return (
      <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
        <path
          d="M12 2L19 10L15 21H9L5 10L12 2Z"
          fill="#8b5cf6"
          stroke="#0e0c14"
          strokeWidth="2"
          strokeLinejoin="round"
        />
        <path d="M12 4L15 10L12 19L9 10Z" fill="#ddd6fe" />
      </svg>
    );
  }
  if (material === 'ember_ash') {
    return (
      <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
        <path
          d="M12 3C15.5 7 18 10 18 14A6 6 0 1 1 6 14C6 10 8.5 7 12 3Z"
          fill="#ea580c"
          stroke="#0e0c14"
          strokeWidth="2"
          strokeLinejoin="round"
        />
        <path d="M12 9C14 11.5 14.5 13 14.5 14.8A2.5 2.5 0 1 1 9.5 14.8C9.5 13 10 11.5 12 9Z" fill="#fde047" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path
        d="M12 3L18 12L12 21L6 12L12 3Z"
        fill="#10b981"
        stroke="#0e0c14"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path d="M12 7L14.5 12L12 17L9.5 12Z" fill="#a7f3d0" />
    </svg>
  );
}

export function SlashIcon({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path
        d="M19 4L14 13L11 10L19 4Z"
        fill="#f5c469"
        stroke="#0e0c14"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path d="M10 11L13 14L7 20L4 17L10 11Z" fill="#cbd5e1" stroke="#0e0c14" strokeWidth="1.6" />
      <path d="M5 6C9 4 15 5 19 9" stroke="#fde68a" strokeWidth="1.8" strokeLinecap="round" fill="none" />
    </svg>
  );
}

export function DashIcon({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path
        d="M4 12H16M12 6L19 12L12 18"
        stroke="#c084fc"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <path d="M3 8H9M3 16H9" stroke="#a78bfa" strokeWidth="1.8" strokeLinecap="round" opacity="0.65" />
    </svg>
  );
}

export function NovaIcon({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <circle cx="12" cy="12" r="7.5" stroke="#a78bfa" strokeWidth="2" fill="rgba(167,139,250,0.22)" />
      <path d="M12 2V6M12 18V22M2 12H6M18 12H22" stroke="#e9d5ff" strokeWidth="2" strokeLinecap="round" />
      <circle cx="12" cy="12" r="3" fill="#f5c469" />
    </svg>
  );
}

export function LanceIcon({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path
        d="M3 20L15 8M15 8L20 4L16 12L15 8Z"
        stroke="#c084fc"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="#e9d5ff"
      />
    </svg>
  );
}

export function FlaskIcon({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path
        d="M9 3H15V6L18.5 14.5C19.3 16.5 17.8 19 15.6 19H8.4C6.2 19 4.7 16.5 5.5 14.5L9 6V3Z"
        fill="#064e3b"
        stroke="#0e0c14"
        strokeWidth="1.8"
      />
      <path d="M7.2 14.5H16.8L15.8 17.2H8.2L7.2 14.5Z" fill="#34d399" />
      <path d="M8.5 3H15.5" stroke="#f5c469" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export function ForgeIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path
        d="M3 10H16L21 13L15 15L16 20H7L9 15L4 13L3 10Z"
        fill="#cbd5e1"
        stroke="#0e0c14"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path d="M8 6L12 3L16 6" stroke="#f5c469" strokeWidth="1.8" strokeLinecap="round" fill="none" />
    </svg>
  );
}

export function SkillTreeIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path d="M12 6V12M12 12L6 18M12 12L18 18" stroke="#c99b52" strokeWidth="2" strokeLinecap="round" />
      <circle cx="12" cy="5" r="2.8" fill="#f5c469" stroke="#0e0c14" strokeWidth="1.5" />
      <circle cx="6" cy="18" r="2.6" fill="#a78bfa" stroke="#0e0c14" strokeWidth="1.5" />
      <circle cx="18" cy="18" r="2.6" fill="#34d399" stroke="#0e0c14" strokeWidth="1.5" />
    </svg>
  );
}
