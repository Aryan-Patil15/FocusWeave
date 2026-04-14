
'use client';

import Link from 'next/link';
import {
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
} from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import { SidebarNav } from './sidebar-nav';
import { Logo } from '@/components/icons';
import { LogOut } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';

export function AppSidebar() {
  const { user, logout } = useAuth();

  return (
    <Sidebar collapsible="icon" side="left" variant="sidebar" className="border-r">
      <SidebarHeader className="p-4 md:p-4 md:bg-transparent">
        <Link href="/dashboard" className="block md:hidden group-data-[collapsible=icon]:block">
          <Logo className="hover:opacity-80 transition-opacity" />
          <span className="sr-only">FocusWeave Home</span>
        </Link>
        <Link href="/dashboard" className="hidden md:block group-data-[collapsible=icon]:hidden">
          <Logo className="hover:opacity-80 transition-opacity" />
        </Link>
      </SidebarHeader>
      <SidebarContent className="flex-1 p-0">
        <SidebarNav />
      </SidebarContent>
      {user && (
        <SidebarFooter className="p-2 border-t mt-auto">
          <Button variant="ghost" className="w-full justify-start group-data-[collapsible=icon]:justify-center" onClick={logout} title="Log out">
            <LogOut className="mr-2 h-5 w-5 group-data-[collapsible=icon]:mr-0 text-muted-foreground" />
            <span className="group-data-[collapsible=icon]:hidden font-medium truncate">
              {user.displayName?.trim() || user.email?.split('@')[0] || 'Logout'}
            </span>
          </Button>
        </SidebarFooter>
      )}
    </Sidebar>
  );
}
