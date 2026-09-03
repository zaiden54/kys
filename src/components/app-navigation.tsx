"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { SignOutButton } from "@/components/sign-out-button";

type IconProps = { className?: string };
type NavItem = {
  href: string;
  label: string;
  shortLabel: string;
  icon: (props: IconProps) => React.ReactNode;
  disabled?: boolean;
};
type NavGroup = { label: string; items: readonly NavItem[] };

function HomeIcon({ className }: IconProps) {
  return (
    <svg aria-hidden="true" className={className} viewBox="0 0 24 24" fill="none">
      <path d="M4 10.5 12 4l8 6.5V20H4v-9.5Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
      <path d="M9 20v-6h6v6" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
    </svg>
  );
}

function BonusIcon({ className }: IconProps) {
  return (
    <svg aria-hidden="true" className={className} viewBox="0 0 24 24" fill="none">
      <path d="M5 8.5h14v11H5v-11Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
      <path d="M4 8.5h16M12 8.5v11M8.2 5.7C8.2 4.8 8.9 4 9.9 4c1.2 0 2.1 1.5 2.1 4.5-2.5 0-3.8-1-3.8-2.8Zm7.6 0c0-.9-.7-1.7-1.7-1.7C12.9 4 12 5.5 12 8.5c2.5 0 3.8-1 3.8-2.8Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
    </svg>
  );
}

function VacationIcon({ className }: IconProps) {
  return (
    <svg aria-hidden="true" className={className} viewBox="0 0 24 24" fill="none">
      <path d="M5 7.5h14v12H5v-12Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
      <path d="M8 4v6M16 4v6M5 11h14" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      <path d="m9 15 2 2 4-4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function SettingsIcon({ className }: IconProps) {
  return (
    <svg aria-hidden="true" className={className} viewBox="0 0 24 24" fill="none">
      <path d="M4 7h16M4 17h16M8 4v6M16 14v6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      <circle cx="8" cy="7" r="2" fill="var(--color-secondary)" stroke="currentColor" strokeWidth="1.7" />
      <circle cx="16" cy="17" r="2" fill="var(--color-secondary)" stroke="currentColor" strokeWidth="1.7" />
    </svg>
  );
}

const groups: readonly NavGroup[] = [
  {
    label: "Расчёты",
    items: [
      { href: "/", label: "Главная", shortLabel: "Главная", icon: HomeIcon },
      { href: "/bonuses", label: "Бонусы", shortLabel: "Бонусы", icon: BonusIcon },
      { href: "/vacations", label: "Отпуска", shortLabel: "Отпуска", icon: VacationIcon },
    ],
  },
  {
    label: "Параметры",
    items: [
      {
        href: "/settings/salary",
        label: "Оклад и выплаты",
        shortLabel: "Выплаты",
        icon: SettingsIcon,
      },
    ],
  },
];

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === href : pathname.startsWith(href);
}

export function AppNavigation() {
  const pathname = usePathname();
  const items = groups.flatMap((group) => group.items);

  return (
    <>
      <header className="mobile-app-header">
        <Link href="/" className="brand-lockup" aria-label="НаРуки — главная">
          <span className="brand-mark" aria-hidden="true">₽</span>
          <span>НаРуки</span>
        </Link>
        <SignOutButton />
      </header>

      <aside className="app-sidebar">
        <Link href="/" className="sidebar-brand brand-lockup" aria-label="НаРуки — главная">
          <span className="brand-mark" aria-hidden="true">₽</span>
          <span className="sidebar-expanded">НаРуки</span>
        </Link>

        <nav className="sidebar-nav" aria-label="Основная навигация">
          {groups.map((group) => (
            <div className="sidebar-group" key={group.label}>
              <p className="sidebar-group-label sidebar-expanded">{group.label}</p>
              <ul>
                {group.items.map((item) => {
                  const active = isActive(pathname, item.href);
                  const Icon = item.icon;
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        className="sidebar-link"
                        aria-current={active ? "page" : undefined}
                        aria-disabled={item.disabled || undefined}
                        tabIndex={item.disabled ? -1 : undefined}
                        onClick={item.disabled ? (event) => event.preventDefault() : undefined}
                        title={item.label}
                      >
                        <Icon className="nav-icon" />
                        <span className="sidebar-link-label sidebar-expanded">{item.label}</span>
                        {active ? <span className="sidebar-current sidebar-expanded">сейчас</span> : null}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>

        <div className="sidebar-action">
          <SignOutButton />
        </div>
      </aside>

      <nav className="mobile-bottom-nav" aria-label="Основная навигация">
        {items.map((item) => {
          const active = isActive(pathname, item.href);
          const Icon = item.icon;
          return (
            <Link
              href={item.href}
              key={item.href}
              className="mobile-nav-link"
              aria-current={active ? "page" : undefined}
              aria-disabled={item.disabled || undefined}
              tabIndex={item.disabled ? -1 : undefined}
              onClick={item.disabled ? (event) => event.preventDefault() : undefined}
            >
              <Icon className="nav-icon" />
              <span>{item.shortLabel}</span>
            </Link>
          );
        })}
      </nav>
    </>
  );
}
