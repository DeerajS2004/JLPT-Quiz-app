import { Link, useRouterState } from "@tanstack/react-router";
import { Home, BookOpen, BarChart3, FileText, GraduationCap, History, FolderOpen } from "lucide-react";

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
} from "@/components/ui/sidebar";

const items = [
  { title: "Dashboard", url: "/", icon: Home },
  { title: "Load Test", url: "/load", icon: BookOpen },
  { title: "Saved Files", url: "/saved-files", icon: FolderOpen },
  { title: "Study", url: "/study", icon: GraduationCap },
  { title: "Last Results", url: "/results", icon: BarChart3 },
  { title: "History", url: "/history", icon: History },
  { title: "Instructions", url: "/instructions", icon: FileText },
];

export function AppSidebar() {
  const currentPath = useRouterState({ select: (s) => s.location.pathname });
  const isActive = (path: string) =>
    path === "/" ? currentPath === "/" : currentPath.startsWith(path);

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b px-4 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-md bg-hanko text-paper font-display text-lg font-bold shadow-sm">
            日
          </div>
          <div className="group-data-[collapsible=icon]:hidden">
            <div className="font-display text-sm font-semibold leading-tight">JLPT Practice</div>
            <div className="text-xs text-muted-foreground">Daily mock tests</div>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navigate</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
                <SidebarMenuItem key={item.url}>
                  <SidebarMenuButton asChild isActive={isActive(item.url)}>
                    <Link to={item.url} className="flex items-center gap-2">
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="border-t px-4 py-3 text-xs text-muted-foreground group-data-[collapsible=icon]:hidden">
        がんばって!
      </SidebarFooter>
    </Sidebar>
  );
}
