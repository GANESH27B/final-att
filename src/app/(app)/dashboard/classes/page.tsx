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
import { useCollection, useFirestore, useMemoFirebase } from "@/firebase";
import { collection, collectionGroup } from "firebase/firestore";
import { AddClassDialog } from "./components/add-class-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import type { Class, User as UserType } from "@/lib/types";
import { useEffect, useState } from "react";
import Link from "next/link";

interface EnrichedClass extends Class {
  facultyName: string;
  studentCount: number;
}

export default function ClassManagementPage() {
  const firestore = useFirestore();
  
  const classesQuery = useMemoFirebase(() => firestore ? collectionGroup(firestore, 'classes') : null, [firestore]);
  const { data: classes, isLoading: isLoadingClasses } = useCollection<Class>(classesQuery);

  const usersCollection = useMemoFirebase(() => firestore ? collection(firestore, 'users') : null, [firestore]);
  const { data: users, isLoading: isLoadingUsers } = useCollection<UserType>(usersCollection);

  const [enrichedClasses, setEnrichedClasses] = useState<EnrichedClass[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setIsLoading(isLoadingClasses || isLoadingUsers);
    if (classes && users) {
      const facultyMap = new Map(users.filter(u => u.role === 'faculty').map(f => [f.id, f.name]));
      
      const studentsByClass = classes.reduce((acc, cls) => {
        // This logic is slightly flawed as student documents don't live under classes directly in the users collection.
        // A proper implementation would query the subcollection of students for each class.
        // For now, we assume a `classId` field on the user object for simplicity.
        const classStudents = users.filter(u => u.role === 'student' && u.classId === cls.id);
        acc.set(cls.id, classStudents.length);
        return acc;
      }, new Map<string, number>());

      const enriched = classes.map(cls => ({
        ...cls,
        facultyName: facultyMap.get(cls.facultyId) || 'Unknown Faculty',
        studentCount: studentsByClass.get(cls.id) || 0,
      }));
      setEnrichedClasses(enriched);
    }
  }, [classes, users, isLoadingClasses, isLoadingUsers]);


  const faculty = users?.filter((user) => user.role === 'faculty') || [];
  
  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight font-headline">
            Class Management
          </h1>
          <p className="text-muted-foreground">
            Create and manage classes and sections.
          </p>
        </div>
        <AddClassDialog faculty={faculty} />
      </div>

      {isLoading ? (
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
        <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {enrichedClasses.map((cls) => (
            <Card key={cls.id} className="flex flex-col">
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
                <Link href={`/dashboard/classes/${cls.id}`} passHref className="w-full">
                  <Button variant="outline" className="w-full">
                    Manage Class
                  </Button>
                </Link>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
