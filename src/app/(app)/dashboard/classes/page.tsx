
"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from "@/components/ui/card";
import { useCollection, useFirestore, useMemoFirebase, useUser } from "@/firebase";
import { collection, getDoc, query, where, doc } from "firebase/firestore";
import { AddClassDialog } from "./components/add-class-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import type { Class, User as UserType } from "@/lib/types";
import { useEffect, useState, useMemo } from "react";
import Link from "next/link";

export default function ClassManagementPage() {
  const firestore = useFirestore();
  const { user: currentUser, isUserLoading: isUserLoadingAuth } = useUser();
  
  const [user, setUser] = useState<UserType | null>(null);
  const [isLoadingUserRole, setIsLoadingUserRole] = useState(true);

  // Get the user's role from their user document
  useEffect(() => {
    if (firestore && currentUser && !user) {
      setIsLoadingUserRole(true);
      const userDocRef = doc(firestore, 'users', currentUser.uid);
      getDoc(userDocRef).then(docSnap => {
        if (docSnap.exists()) {
          setUser({ id: docSnap.id, ...docSnap.data() } as UserType);
        }
        setIsLoadingUserRole(false);
      }).catch(() => setIsLoadingUserRole(false));
    } else if (!currentUser && !isUserLoadingAuth) {
      setIsLoadingUserRole(false);
    }
  }, [firestore, currentUser, isUserLoadingAuth, user]);

  // Determine which classes to query based on role
  const classesQuery = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    if (user.role === 'admin') {
      return collection(firestore, 'classes');
    }
    if (user.role === 'faculty') {
      return query(collection(firestore, 'classes'), where('facultyId', '==', user.id));
    }
    return null; // Students see no classes on this page
  }, [firestore, user]);
  
  const { data: classes, isLoading: isLoadingClasses } = useCollection<Class>(classesQuery);

  // Fetch all faculty members for the "Add Class" dialog (only for admins)
  const facultyQuery = useMemoFirebase(() => 
    firestore && user?.role === 'admin' ? query(collection(firestore, 'users'), where('role', '==', 'faculty')) : null, 
  [firestore, user]);
  const { data: faculty, isLoading: isLoadingFaculty } = useCollection<UserType>(facultyQuery);
  
  const finalIsLoading = isUserLoadingAuth || isLoadingUserRole || isLoadingClasses || (user?.role === 'admin' && isLoadingFaculty);
  
  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight font-headline">
            Class Management
          </h1>
          <p className="text-muted-foreground">
            {user?.role === 'admin' ? "Create and manage classes and sections." : "View and manage your assigned classes."}
          </p>
        </div>
        {user?.role === 'admin' && <AddClassDialog faculty={faculty || []} />}
      </div>

      {finalIsLoading ? (
         <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
                <Card key={i}>
                    <CardHeader>
                        <Skeleton className="h-6 w-3/4" />
                        <Skeleton className="h-4 w-1/2" />
                    </CardHeader>
                    <CardContent>
                       <div className="h-10" />
                    </CardContent>
                    <CardFooter>
                       <Skeleton className="h-10 w-full" />
                    </CardFooter>
                </Card>
            ))}
         </div>
      ) : (
        <>
          {classes && classes.length > 0 ? (
            <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {classes.map((cls) => (
                <Card key={cls.id} className="flex flex-col h-full hover:bg-muted/50 transition-colors">
                  <Link href={`/dashboard/classes/${cls.id}`} passHref className="flex flex-col flex-grow">
                    <CardHeader>
                      <CardTitle>{cls.name}</CardTitle>
                      <CardDescription>Section {cls.section}</CardDescription>
                    </CardHeader>
                    <CardContent className="flex-grow">
                      {/* Content removed for simplicity */}
                    </CardContent>
                    <CardFooter>
                        <p className="text-xs text-muted-foreground w-full text-center">Click to manage</p>
                    </CardFooter>
                  </Link>
                </Card>
              ))}
            </div>
          ) : (
            <div className="text-center text-muted-foreground p-8 border-dashed border-2 rounded-md mt-4">
                <p>No classes found.</p>
                {user?.role === 'admin' && <p className="text-sm">Click "Add Class" to create the first one.</p>}
            </div>
          )}
        </>
      )}
    </div>
  );
}
