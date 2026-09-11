import { useAuthActions } from "@convex-dev/auth/react";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Avatar, AvatarFallback } from "../ui/avatar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "../ui/dropdown-menu";
import { Icon } from "../ui/icon";
import { showToast } from "../ui/sonner";
import { useCopy } from "../../ui/copy";

export function LiveProfileMenu({ name, operator = false }: { name: string; operator?: boolean }) {
  const { t } = useCopy();
  const { signOut } = useAuthActions();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const initials = name.trim().split(/[\s_-]+/).filter(Boolean).slice(0, 2).map(part => part[0]).join("").toLocaleUpperCase();
  async function logout() {
    setBusy(true);
    try { await signOut(); navigate("/", { replace: true }); }
    catch { showToast(t("appRoutes.signOutError")); }
    finally { setBusy(false); }
  }
  return <DropdownMenu>
    <DropdownMenuTrigger asChild>
      <Avatar asChild interactive><button type="button" aria-label={t("appRoutes.profileMenu")}><AvatarFallback>{initials}</AvatarFallback></button></Avatar>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end">
      <DropdownMenuLabel>{name}</DropdownMenuLabel>
      <DropdownMenuSeparator />
      <DropdownMenuItem asChild><Link to="/app/settings"><Icon name="sliders" />{t("appRoutes.settings")}</Link></DropdownMenuItem>
      <DropdownMenuItem asChild><Link to="/app/inbox"><Icon name="mail" />{t("appRoutes.messages")}</Link></DropdownMenuItem>
      {operator ? <DropdownMenuItem asChild><Link to="/ops"><Icon name="building" />{t("appRoutes.operator")}</Link></DropdownMenuItem> : null}
      <DropdownMenuSeparator />
      <DropdownMenuItem disabled={busy} onSelect={() => void logout()}><Icon name="arrow-left" />{t("appRoutes.signOut")}</DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>;
}
