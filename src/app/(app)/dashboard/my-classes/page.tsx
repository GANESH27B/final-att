
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
import { collection, query, where } from "firebase/firestore";
import { Skeleton } from "@/components/ui/skeleton";
import type { Class, User as UserType } from "@/lib/types";
import { useMemo } from "react";
import Link from "next/link";
import { Users } from "lucide-react";

function ClassCard({ cls }: { cls: Class; }) {
    const firestore = useFirestore();
    const enrolledStudentsCollectionRef = useMemoFirebase(() => 
        (firestore ? collection(firestore, `classes/${cls.id}/students`) : null), 
        [firestore, cls.id]
    );
    const { data: enrolledStudents, isLoading: isLoadingEnrolled } = useCollection<UserType>(enrolledStudentsCollectionRef);

    return (
        <Card className="flex flex-col h-full hover:bg-muted/50 transition-colors">
            <CardHeader>
                <CardTitle>Section {cls.section}</CardTitle>
                <CardDescription>{cls.name}</CardDescription>
            </CardHeader>
            <CardContent className="flex-grow">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Users className="h-4 w-4" />
                    {isLoadingEnrolled ? (
                        <Skeleton className="h-4 w-16" />
                    ) : (
                        <span>{enrolledStudents?.length || 0} Student{enrolledStudents?.length !== 1 ? 's' : ''}</span>
                    )}
                </div>
            </CardContent>
            <CardFooter>
                 <div className="h-5" />
            </CardFooter>
        </Card>
    );
}


function ClassCardSkeleton() {
    return (
        <Card>
            <CardHeader>
                <Skeleton className="h-6 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
            </CardHeader>
            <CardContent>
                 <Skeleton className="h-4 w-16" />
            </CardContent>
            <CardFooter>
                <div className="h-5" />
            </CardFooter>
        </Card>
    );
}

export default function MyClassesPage() {
  const firestore = useFirestore();
  const { user: currentUser } = useUser();

  const studentAttendanceQuery = useMemoFirebase(() => 
    firestore && currentUser ? collection(firestore, `users/${currentUser.uid}/attendance`) : null,
    [firestore, currentUser]
  );
  const { data: attendanceRecords, isLoading: isLoadingAttendance } = useCollection(studentAttendanceQuery);
  
  const enrolledClassIds = useMemo(() => {
    if (!attendanceRecords) return [];
    return [...new Set(attendanceRecords.map(r => r.classId))];
  }, [attendanceRecords]);
  
  const classesQuery = useMemoFirebase(() => {
    if (!firestore || enrolledClassIds.length === 0) return null;
    return query(collection(firestore, 'classes'), where('__name__', 'in', enrolledClassIds));
  }, [firestore, enrolledClassIds]);

  const { data: classes, isLoading: isLoadingClasses } = useCollection<Class>(classesQuery);
  
  const isLoading = isLoadingAttendance || isLoadingClasses;

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight font-headline">
            My Classes
          </h1>
          <p className="text-muted-foreground">
            Here are the classes you are enrolled in.
          </p>
        </div>
      </div>

      {isLoading ? (
         <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => <ClassCardSkeleton key={i} />)}
         </div>
      ) : (
        <>
          {classes && classes.length > 0 ? (
            <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {classes.map((cls) => (
                <ClassCard key={cls.id} cls={cls} />
              ))}
            </div>
          ) : (
            <div className="text-center text-muted-foreground p-8 border-dashed border-2 rounded-md mt-4">
                <p>You are not enrolled in any classes yet.</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
