import React from 'react';
import { FileText, Users, Check, BookOpen } from 'lucide-react';
import { User } from '../api/client';

interface NavbarProps {
  users: User[];
  currentUser: User | null;
  onSelectUser: (userId: string) => void;
  onNavigateHome: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  users,
  currentUser,
  onSelectUser,
  onNavigateHome
}) => {
  const swaggerUrl = import.meta.env.VITE_API_URL
    ? `${import.meta.env.VITE_API_URL.replace(/\/$/, '')}/docs`
    : typeof window !== 'undefined' && window.location.port === '5173'
    ? 'http://localhost:4000/api/docs'
    : '/api/docs';

  return (
    <header className="no-print sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
        <button
          type="button"
          onClick={onNavigateHome}
          className="flex items-center gap-2.5 text-left transition hover:opacity-85"
        >
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-600 text-white shadow-sm">
            <FileText className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-base font-bold tracking-tight text-slate-900">
                Ajaia Docs
              </span>
              <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-[11px] font-semibold text-indigo-700 border border-indigo-200">
                Workspace
              </span>
            </div>
            <p className="text-xs text-slate-500 hidden sm:block">
              Collaborative Document Editor &amp; Sharing Demo
            </p>
          </div>
        </button>

        {/* Right Controls: Swagger UI Link + 1-Click Persona Switcher */}
        <div className="flex items-center gap-3">
          <a
            href={swaggerUrl}
            target="_blank"
            rel="noreferrer"
            title="Open Backend Swagger UI API Documentation"
            className="hidden sm:inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-xs transition hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700"
          >
            <BookOpen className="h-3.5 w-3.5 text-indigo-600" />
            <span>Swagger API</span>
          </a>

          <div className="hidden lg:flex items-center gap-1.5 text-xs font-medium text-slate-500">
            <Users className="h-3.5 w-3.5 text-indigo-600" />
            <span>Switch Persona:</span>
          </div>

          <div className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-100/80 p-1">
            {users.map((u) => {
              const isActive = currentUser?.id === u.id;
              const initials = u.name
                .split(' ')
                .map((n) => n[0])
                .join('');
              return (
                <button
                  key={u.id}
                  type="button"
                  onClick={() => onSelectUser(u.id)}
                  title={`${u.name} (${u.email}) — ${u.role_title}`}
                  className={`flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-medium transition ${
                    isActive
                      ? 'bg-white text-slate-900 shadow-sm ring-1 ring-slate-200'
                      : 'text-slate-600 hover:bg-white/60 hover:text-slate-900'
                  }`}
                >
                  <span
                    className="flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold text-white"
                    style={{ backgroundColor: u.avatar_color }}
                  >
                    {initials}
                  </span>
                  <span className="hidden sm:inline">{u.name.split(' ')[0]}</span>
                  {isActive && <Check className="h-3 w-3 text-indigo-600" />}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </header>
  );
};
