"use client"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { BookOpen, Percent } from "lucide-react";
import { useCollection, useFirestore, useUser, useMemoFirebase } from "@/firebase";
import { collection, collectionGroup, query, where } from "firebase/firestore";
import { AttendanceRecord, User } from "@/lib/types";
import { useMemo } from "react";
import { Skeleton } from "@/components/ui/skeleton";

export default function StudentDashboardPage() {
  const firestore = useFirestore();
  const { user } = useUser();

  // Query for attendance records
  const studentAttendanceQuery = useMemoFirebase(() => 
    firestore && user ? query(collection(firestore, `users/${user.uid}/attendance`)) : null,
    [firestore, user]
  );
  const { data: attendanceRecords, isLoading: isLoadingAttendance } = useCollection<AttendanceRecord>(studentAttendanceQuery);

  // Query for enrolled classes using a collection group query
  const enrolledClassesQuery = useMemoFirebase(() =>
    firestore && user ? query(collectionGroup(firestore, 'students'), where('id', '==', user.uid)) : null,
    [firestore, user]
  );
  const { data: enrolledClasses, isLoading: isLoadingEnrolled } = useCollection<User>(enrolledClassesQuery);

  
  const { avgAttendance } = useMemo(() => {
    if (!attendanceRecords) return { avgAttendance: 0 };
    
    const presentCount = attendanceRecords.filter(r => r.status === 'Present').length;
    const average = attendanceRecords.length > 0 ? (presentCount / attendanceRecords.length) * 100 : 0;

    return { avgAttendance: average };
  }, [attendanceRecords]);

  const totalEnrolledClasses = useMemo(() => {
    return enrolledClasses?.length || 0;
  }, [enrolledClasses]);

  const isLoading = isLoadingAttendance || isLoadingEnrolled;

  return (
    <div className="space-y-4">
        <h1 className="text-2xl font-bold tracking-tight font-headline">Student Dashboard</h1>
      <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Enrolled Classes</CardTitle>
            <BookOpen className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? <Skeleton className="h-8 w-1/2" /> : <div className="text-2xl font-bold">{totalEnrolledClasses}</div>}
            <p className="text-xs text-muted-foreground">
              All your subjects this semester.
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg. Attendance</CardTitle>
            <Percent className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? <Skeleton className="h-8 w-1/2" /> : <div className="text-2xl font-bold">{avgAttendance.toFixed(1)}%</div>}
            <p className="text-xs text-muted-foreground">
              Across all your classes.
            </p>
          </CardContent>
        </Card>
      </div>

    </div>
  );
}
