"use client"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { BookOpen, Percent } from "lucide-react";
import { useCollection, useFirestore, useUser, useMemoFirebase } from "@/firebase";
import { collection, query, where, collectionGroup } from "firebase/firestore";
import { AttendanceRecord, User } from "@/lib/types";
import { useMemo } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { format, parseISO } from "date-fns";

export default function StudentDashboardPage() {
  const firestore = useFirestore();
  const { user } = useUser();

  // Query for all student attendance records
  const studentAttendanceQuery = useMemoFirebase(() => 
    firestore && user ? query(collection(firestore, `users/${user.uid}/attendance`)) : null,
    [firestore, user]
  );
  const { data: allAttendanceRecords, isLoading: isLoadingAttendance } = useCollection<AttendanceRecord>(studentAttendanceQuery);

  // Query for all class enrollments using the studentId field
  const enrolledClassesQuery = useMemoFirebase(() =>
    firestore && user ? query(collectionGroup(firestore, 'students'), where('studentId', '==', user.uid)) : null,
    [firestore, user]
  );
  const { data: enrolledClasses, isLoading: isLoadingEnrolled } = useCollection<User>(enrolledClassesQuery);

  
  const avgAttendance = useMemo(() => {
    if (!allAttendanceRecords || allAttendanceRecords.length === 0) return 0;
    
    const presentCount = allAttendanceRecords.filter(r => r.status === 'Present').length;
    return (presentCount / allAttendanceRecords.length) * 100;
  }, [allAttendanceRecords]);

  const totalEnrolledClasses = useMemo(() => {
    return enrolledClasses?.length || 0;
  }, [enrolledClasses]);

  const sortedAttendance = useMemo(() => {
    if (!allAttendanceRecords) return [];
    return [...allAttendanceRecords].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [allAttendanceRecords]);

  const isLoading = isLoadingAttendance || isLoadingEnrolled;

  return (
    <div className="space-y-6">
        <h1 className="text-2xl font-bold tracking-tight font-headline">Student Dashboard</h1>
      <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
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
            <CardTitle className="text-sm font-medium">Overall Attendance</CardTitle>
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

      <Card>
        <CardHeader>
          <CardTitle>Daily Attendance Log</CardTitle>
          <CardDescription>Your day-to-day attendance record for all classes.</CardDescription>
        </CardHeader>
        <CardContent>
           {isLoading ? (
             <div className="space-y-2">
               <Skeleton className="h-10 w-full" />
               <Skeleton className="h-10 w-full" />
               <Skeleton className="h-10 w-full" />
             </div>
           ) : (
             <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Class</TableHead>
                    <TableHead className="text-right">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedAttendance.length > 0 ? (
                    sortedAttendance.map((record) => (
                      <TableRow key={record.id}>
                        <TableCell className="font-medium">
                          {format(parseISO(record.date), "MMMM d, yyyy")}
                        </TableCell>
                        <TableCell>{record.className || record.classId}</TableCell>
                        <TableCell className="text-right">
                          <Badge variant={record.status === 'Present' ? 'secondary' : 'destructive'}>
                            {record.status}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={3} className="h-24 text-center">
                        No attendance records found.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
           )}
        </CardContent>
      </Card>
    </div>
  );
}
