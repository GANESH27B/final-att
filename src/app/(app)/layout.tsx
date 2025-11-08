
'use client';

import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { SidebarNav } from "@/components/sidebar-nav";
import { UserNav } from "@/components/user-nav";
import { ThemeToggle } from "@/components/theme-toggle";
import { Badge } from "@/components/ui/badge";
import { useUser, useFirestore, errorEmitter, FirestorePermissionError } from "@/firebase";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { UserRole, User } from "@/lib/types";
import { doc, getDoc } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";
import { Shield, Loader2 } from "lucide-react";


export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, isUserLoading: userLoading } = useUser();
  const router = useRouter();
  const firestore = useFirestore();
  const [userData, setUserData] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const { toast } = useToast();
  
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    // Wait until Firebase Auth has determined the user's status.
    if (userLoading) {
      setLoading(true);
      return;
    }

    // If auth is ready and there's no user, redirect to login.
    if (!user) {
      router.replace("/login");
      return;
    }

    // If we have a user but haven't fetched their role from Firestore yet.
    if (firestore && user && !userData) {
      const userDocRef = doc(firestore, "users", user.uid);
      getDoc(userDocRef)
        .then((docSnap) => {
          if (docSnap.exists()) {
            const userRoleData = { id: docSnap.id, ...docSnap.data() } as User;
            setUserData(userRoleData);
          } else {
             // This might happen if the user doc isn't created yet or was deleted.
             toast({
                variant: "destructive",
                title: "User Data Not Found",
                description: "Your user profile could not be loaded. Please log in again.",
             });
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
                    description: "Could not fetch user data. Redirecting to login.",
                });
                router.push("/login");
            }
        })
        .finally(() => {
          // This will be set to false regardless of success/fail,
          // the other checks will handle redirection if needed.
          setLoading(false);
        });
    } else if (userData) {
        // User and their role data are loaded.
        setLoading(false);
    }
  }, [user, userLoading, firestore, router, toast, userData]);

  // This is the main loading gate. It shows a loader if either Firebase Auth is working
  // or if we are in the process of fetching the user's role from Firestore.
  // It only proceeds to render children when both are complete and successful.
  if (loading || userLoading || !userData) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="flex flex-col items-center gap-2">
            <Loader2 className="h-8 w-8 animate-spin" />
            <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <SidebarProvider>
      <SidebarNav role={userData.role} />
      <SidebarInset>
        <header className="sticky top-0 z-30 flex h-14 items-center gap-4 border-b bg-background/95 px-4 backdrop-blur-sm sm:static sm:h-auto sm:border-0 sm:bg-transparent sm:px-6">
           <div className="flex items-center gap-2 md:hidden">
              <SidebarTrigger />
              <Shield className="w-8 h-8 text-primary" />
              <h1 className="text-xl font-semibold font-headline">AttendSync</h1>
           </div>
          <div className="flex items-center gap-2 ml-auto">
             <Badge variant={isOnline ? 'outline' : 'secondary'} className="hidden sm:flex items-center gap-2">
                <span className="relative flex h-2 w-2">
                    {isOnline ? (
                      <>
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                      </>
                    ) : (
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-gray-400"></span>
                    )}
                </span>
                {isOnline ? "Online" : "Offline"}
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
