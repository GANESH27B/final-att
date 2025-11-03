'use client';

import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { SidebarNav } from "@/components/sidebar-nav";
import { UserNav } from "@/components/user-nav";
import { ThemeToggle } from "@/components/theme-toggle";
import { Badge } from "@/components/ui/badge";
import { useUser, useFirestore, errorEmitter, FirestorePermissionError } from "@/firebase";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { UserRole } from "@/lib/types";
import { doc, getDoc } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";
import { Shield } from "lucide-react";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, isUserLoading: userLoading } = useUser();
  const router = useRouter();
  const pathname = usePathname();
  const firestore = useFirestore();
  const [role, setRole] = useState<UserRole | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    if (userLoading) {
        setLoading(true);
        return; // Wait until Firebase auth state is resolved
    }

    if (!user) {
      router.push("/login");
      setLoading(false);
      return;
    }

    if (firestore && user) {
      const userDocRef = doc(firestore, "users", user.uid);
      getDoc(userDocRef)
        .then((docSnap) => {
          if (docSnap.exists()) {
            const userData = docSnap.data();
            const userRole = userData.role as UserRole;
            setRole(userRole);
            
            const isAuthorized = (role: UserRole, path: string) => {
                const adminPaths = ['/dashboard/admin', '/dashboard/users', '/dashboard/classes', '/dashboard/analytics'];
                const facultyPaths = ['/dashboard/faculty', '/dashboard/attendance', '/dashboard/analytics'];
                const studentPaths = ['/dashboard/student', '/dashboard/my-attendance'];

                if (role === 'admin') {
                    // Admin can access their paths.
                    return adminPaths.some(p => path.startsWith(p));
                }
                if (role === 'faculty') {
                    return facultyPaths.some(p => path.startsWith(p));
                }
                if (role === 'student') {
                    return studentPaths.some(p => path.startsWith(p));
                }
                return false;
            }

            if (pathname === '/dashboard' || pathname === '/dashboard/') {
                router.replace(`/dashboard/${userRole}`);
            } else if (!isAuthorized(userRole, pathname)) {
                // If user is on a page they are not authorized for, redirect them to their main dashboard.
                router.replace(`/dashboard/${userRole}`);
            }
          } else {
             // If user is authenticated but has no firestore doc, send to login
             router.push("/login");
          }
        })
        .catch((e) => {
           if (e.code === 'permission-denied') {
                const permissionError = new FirestorePermissionError({
                  path: userDocRef.path,
                  operation: 'get',
                });
                errorEmitter.emit('permission-error', permissionError);
            } else {
                toast({
                    variant: "destructive",
                    title: "Error",
                    description: "Could not fetch user data.",
                });
                router.push("/login");
            }
        })
        .finally(() => {
          setLoading(false);
        });
    }
  }, [user, userLoading, firestore, router, toast, pathname]);

  if (loading || !user || !role) {
    return (
      <div className="flex h-screen items-center justify-center">
        <p>Loading...</p>
      </div>
    );
  }

  return (
    <SidebarProvider>
      <SidebarNav role={role} />
      <SidebarInset>
        <header className="sticky top-0 z-30 flex h-14 items-center gap-4 border-b bg-background/95 px-4 backdrop-blur-sm sm:static sm:h-auto sm:border-0 sm:bg-transparent sm:px-6">
           <div className="flex items-center gap-2 md:hidden">
              <SidebarTrigger />
              <Shield className="w-8 h-8 text-primary" />
              <h1 className="text-xl font-semibold font-headline">AttendSync</h1>
           </div>
          <div className="flex items-center gap-2 ml-auto">
             <Badge variant="outline" className="hidden sm:flex items-center gap-2">
                <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                </span>
                Online
             </Badge>
            <ThemeToggle />
            <UserNav />
          </div>
        </header>
        <main className="flex-1 p-4 sm:px-6 sm:py-0 space-y-4">
            {children}
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
