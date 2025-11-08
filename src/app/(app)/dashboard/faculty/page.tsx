
"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Users, BookOpen } from "lucide-react";
import { useCollection, useFirestore, useUser, useMemoFirebase } from "@/firebase";
import { collection, query, where, getDocs } from "firebase/firestore";
import { Class } from "@/lib/types";
import { useState, useEffect } from "react";
import { Skeleton } from "@/components/ui/skeleton";

export default function FacultyDashboardPage() {
  const firestore = useFirestore();
  const { user: currentUser } = useUser();
  
  // 1. Fetch classes for the current faculty
  const facultyClassesQuery = useMemoFirebase(() => 
    firestore && currentUser ? query(collection(firestore, 'classes'), where('facultyId', '==', currentUser.uid)) : null,
    [firestore, currentUser]
  );
  const { data: facultyClasses, isLoading: isLoadingClasses } = useCollection<Class>(facultyClassesQuery);

  // 2. Fetch total students
  const [studentCount, setStudentCount] = useState(0);
  const [isLoadingStudents, setIsLoadingStudents] = useState(true);

  useEffect(() => {
    if (facultyClasses && firestore) {
      setIsLoadingStudents(true);
      let totalStudents = new Set<string>();

      if (facultyClasses.length === 0) {
        setStudentCount(0);
        setIsLoadingStudents(false);
        return;
      }

      const fetchStudentsPromises = facultyClasses.map(cls => {
        const studentsCollectionRef = collection(firestore, 'classes', cls.id, 'students');
        return getDocs(studentsCollectionRef);
      });

      Promise.all(fetchStudentsPromises)
        .then(snapshots => {
          snapshots.forEach(snapshot => {
            snapshot.forEach(doc => totalStudents.add(doc.id));
          });
          setStudentCount(totalStudents.size);
        })
        .finally(() => setIsLoadingStudents(false));
    } else if (!isLoadingClasses) {
      setIsLoadingStudents(false);
      setStudentCount(0);
    }
  }, [facultyClasses, firestore, isLoadingClasses]);

  const isLoading = isLoadingClasses || isLoadingStudents;

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold tracking-tight font-headline">Faculty Dashboard</h1>
      <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">My Classes</CardTitle>
            <BookOpen className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? <Skeleton className="h-8 w-1/2" /> : <div className="text-2xl font-bold">{facultyClasses?.length || 0}</div>}
            <p className="text-xs text-muted-foreground">This semester</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Students</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? <Skeleton className="h-8 w-1/2" /> : <div className="text-2xl font-bold">{studentCount}</div>}
            <p className="text-xs text-muted-foreground">Across all your classes</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
