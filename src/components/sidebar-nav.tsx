"use client";

import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarFooter,
} from "@/components/ui/sidebar";
import {
  Home,
  Users,
  BookOpen,
  ScanLine,
  PieChart,
  BarChart2,
  BadgeInfo,
  LogOut,
  Shield,
} from "lucide-react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { UserRole } from "@/lib/types";
import { Separator } from "./ui/separator";

interface SidebarNavProps {
  role: UserRole;
}

const adminNav = [
  { href: "/dashboard", icon: Home, label: "Dashboard" },
  { href: "/dashboard/users", icon: Users, label: "User Management" },
  { href: "/dashboard/classes", icon: BookOpen, label: "Class Management" },
  { href: "/dashboard/analytics", icon: PieChart, label: "Analytics & Reports" },
];

const facultyNav = [
  { href: "/dashboard", icon: Home, label: "Dashboard" },
  { href: "/dashboard/attendance", icon: ScanLine, label: "Take Attendance" },
  { href: "/dashboard/analytics", icon: BarChart2, label: "My Classes" },
];

const studentNav = [
  { href: "/dashboard/my-attendance", icon: BarChart2, label: "My Attendance" },
];

const navItems = {
  admin: adminNav,
  faculty: facultyNav,
  student: studentNav,
};

export function SidebarNav({ role = "admin" }: SidebarNavProps) {
  const pathname = usePathname();

  // For demonstration, we'll allow switching roles. In a real app, this would be derived from session.
  const isStudent = pathname.startsWith('/dashboard/my-attendance');
  const isFaculty = pathname.startsWith('/dashboard/attendance');
  
  let activeRole: UserRole = 'admin';
  if (isStudent) activeRole = 'student';
  else if (isFaculty) activeRole = 'faculty';


  const items = navItems[activeRole] || navItems.admin;

  return (
    <Sidebar>
      <SidebarHeader>
        <div className="flex items-center gap-2">
          <Shield className="w-8 h-8 text-primary" />
          <h1 className="text-xl font-semibold font-headline">AttendSync</h1>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarMenu>
          {items.map((item) => (
            <SidebarMenuItem key={item.label}>
              <Link href={item.href} passHref legacyBehavior>
                <SidebarMenuButton
                  isActive={pathname === item.href}
                  tooltip={item.label}
                >
                  <item.icon />
                  <span>{item.label}</span>
                </SidebarMenuButton>
              </Link>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarContent>
      <SidebarFooter>
        <Separator className="my-2" />
         <SidebarMenu>
            <SidebarMenuItem>
                <SidebarMenuButton tooltip="Logout">
                    <LogOut />
                    <span>Logout</span>
                </SidebarMenuButton>
            </SidebarMenuItem>
         </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
