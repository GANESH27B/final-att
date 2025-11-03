
"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { User, Users } from "lucide-react";
import { useCollection, useFirestore, useMemoFirebase, useUser } from "@/firebase";
import { collection, getDocs, query, where, doc, getDoc } from "firebase/firestore";
import { AddClassDialog } from "./components/add-class-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import type { Class, User as UserType } from "@/lib/types";
import { useEffect, useState, useCallback, useMemo } from "react";
import Link from "next/link";

interface EnrichedClass extends Class {
  facultyName: string;
  studentCount: number;
}

export default function ClassManagementPage() {
  const firestore = useFirestore();
  const { user: currentUser, isUserLoading: isUserLoadingAuth } = useUser();
  
  const [user, setUser] = useState<UserType | null>(null);
  const [isLoadingUserRole, setIsLoadingUserRole] = useState(true);

  // Get the user's role from their user document
  useEffect(() => {
    if (firestore && currentUser) {
      const userDocRef = doc(firestore, 'users', currentUser.uid);
      getDoc(userDocRef).then(docSnap => {
        if (docSnap.exists()) {
          setUser({ id: docSnap.id, ...docSnap.data() } as UserType);
        }
        setIsLoadingUserRole(false);
      }).catch(() => setIsLoadingUserRole(false));
    } else if (!isUserLoadingAuth) {
      setIsLoadingUserRole(false);
    }
  }, [firestore, currentUser, isUserLoadingAuth]);

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
  
  const { data: classes, isLoading: isLoadingClasses } = useCollection<Class>(classesQuery, !!user);

  // Fetch all faculty members for the "Add Class" dialog (only for admins)
  const facultyQuery = useMemoFirebase(() => 
    firestore && user?.role === 'admin' ? query(collection(firestore, 'users'), where('role', '==', 'faculty')) : null, 
  [firestore, user]);
  const { data: faculty, isLoading: isLoadingFaculty } = useCollection<UserType>(facultyQuery, user?.role === 'admin');
  
  const [enrichedClasses, setEnrichedClasses] = useState<EnrichedClass[]>([]);
  const [isProcessing, setIsProcessing] = useState(true);
  
  const facultyMap = useMemo(() => {
    const map = new Map<string, string>();
    // For admin role, we fetch all faculty and create a map.
    if (user?.role === 'admin' && faculty) {
      faculty.forEach(f => map.set(f.id, f.name));
    } else if (user?.role === 'faculty') {
      // For faculty, just add themselves to the map.
      map.set(user.id, user.name);
    }
    return map;
  }, [user, faculty]);


  const fetchStudentCounts = useCallback(async () => {
    if (!firestore || !classes || classes.length === 0) return new Map<string, number>();

    const counts = new Map<string, number>();
    for (const cls of classes) {
        try {
            const studentsCollectionRef = collection(firestore, `classes/${cls.id}/students`);
            const snapshot = await getDocs(studentsCollectionRef);
            counts.set(cls.id, snapshot.size);
        } catch (e) {
            console.error(`Could not fetch student count for class ${cls.id}`, e);
            counts.set(cls.id, 0);
        }
    }
    return counts;
  }, [firestore, classes]);


  useEffect(() => {
    const processClasses = async () => {
        if (!classes || isUserLoadingAuth || isLoadingUserRole || (user?.role === 'admin' && isLoadingFaculty)) {
             setIsProcessing(true);
             return;
        }

        setIsProcessing(true);
        const studentCounts = await fetchStudentCounts();

        const enriched = classes.map(cls => ({
            ...cls,
            facultyName: facultyMap.get(cls.facultyId) || 'Unknown Faculty',
            studentCount: studentCounts?.get(cls.id) || 0,
        }));
        setEnrichedClasses(enriched);
        setIsProcessing(false);
    };
    processClasses();
  }, [classes, facultyMap, fetchStudentCounts, isUserLoadingAuth, isLoadingUserRole, user, isLoadingFaculty]);
  
  const finalIsLoading = isUserLoadingAuth || isLoadingUserRole || isLoadingClasses || isProcessing;
  
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
                        <Skeleton className="h-4 w-full mb-2" />
                        <Skeleton className="h-4 w-2/3" />
                    </CardContent>
                    <CardFooter>
                        <Skeleton className="h-10 w-full" />
                    </CardFooter>
                </Card>
            ))}
         </div>
      ) : (
        <>
          {enrichedClasses.length > 0 ? (
            <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {enrichedClasses.map((cls) => (
                <Link key={cls.id} href={`/dashboard/classes/${cls.id}`} passHref>
                  <Card className="flex flex-col h-full hover:bg-muted/50 transition-colors cursor-pointer">
                    <CardHeader>
                      <CardTitle>{cls.name}</CardTitle>
                      <CardDescription>Section {cls.section}</CardDescription>
                    </CardHeader>
                    <CardContent className="flex-grow">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <User className="h-4 w-4" />
                        <span>{cls.facultyName}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground mt-2">
                        <Users className="h-4 w-4" />
                        <span>{cls.studentCount} Students</span>
                      </div>
                    </CardContent>
                    <CardFooter>
                        <p className="text-xs text-muted-foreground w-full text-center">Click to manage</p>
                    </CardFooter>
                  </Card>
                </Link>
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
