import {
  Home,
  Map as MapIcon,
  Users,
  UsersRound,
  Search,
  User,
  LogOut,
  Fish,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { logout } from "@/app/login/actions";
import ThemeToggle from "./ThemeToggle";

const NAV_ITEMS = [
  { href: "/", label: "Strona główna", Icon: Home },
  { href: "/map", label: "Mapa", Icon: MapIcon },
  { href: "/search", label: "Szukaj", Icon: Search },
  { href: "/friends", label: "Znajomi", Icon: Users },
  { href: "/groups", label: "Grupy", Icon: UsersRound },
  { href: "/profile", label: "Profil", Icon: User },
];

export default async function Sidebar() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <nav className="sticky top-0 flex h-screen shrink-0 flex-col justify-between border-r border-border px-2 py-4 lg:w-64 lg:px-4">
      <div className="flex flex-col gap-1">
        <a
          href="/"
          className="mb-4 flex items-center gap-3 rounded-full px-3 py-2 text-primary"
        >
          <Fish size={26} />
          <span className="hidden text-lg font-bold lg:inline">Wędkarski</span>
        </a>

        {user &&
          NAV_ITEMS.map(({ href, label, Icon }) => (
            <a
              key={href}
              href={href}
              className="flex items-center gap-4 rounded-full px-3 py-3 text-base transition-colors hover:bg-muted"
            >
              <Icon size={24} />
              <span className="hidden lg:inline">{label}</span>
            </a>
          ))}
      </div>

      <div className="flex flex-col gap-1">
        <ThemeToggle />
        {user && (
          <form action={logout}>
            <button
              type="submit"
              className="flex w-full items-center gap-4 rounded-full px-3 py-3 text-base transition-colors hover:bg-muted"
            >
              <LogOut size={24} />
              <span className="hidden lg:inline">Wyloguj</span>
            </button>
          </form>
        )}
      </div>
    </nav>
  );
}
