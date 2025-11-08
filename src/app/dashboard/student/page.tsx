
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
import { collection, query, where } from "firebase/firestore";
import { AttendanceRecord, Class } from "@/lib/types";
import { useMemo } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { format, parseISO } from "date-fns";

type CombinedLog = {
  id: string;
  date: string;
  className: string;
  status: "Present" | "Absent";
};

export default function StudentDashboardPage() {
  const firestore = useFirestore();
  const { user } = useUser();

  const studentAttendanceQuery = useMemoFirebase(() => 
    firestore && user ? query(collection(firestore, `users/${user.uid}/attendance`)) : null,
    [firestore, user]
  );
  const { data: presentRecords, isLoading: isLoadingAttendance } = useCollection<AttendanceRecord>(studentAttendanceQuery);
  
  // This query is needed to get the total number of enrolled classes, but we are not using the full data yet.
  const enrolledClassesQuery = useMemoFirebase(() =>
    firestore && user ? query(collection(firestore, 'classes'), where('studentIds', 'array-contains', user.uid)) : null,
    [firestore, user]
  );
  const { data: enrolledClasses, isLoading: isLoadingClasses } = useCollection<Class>(enrolledClassesQuery);

  const dailyLog: CombinedLog[] = useMemo(() => {
    if (!presentRecords) return [];
    const log = presentRecords.map(record => ({
      id: record.id,
      date: record.date,
      className: record.className || 'Unknown Class',
      status: 'Present' as const
    }));
    // Sort by date descending
    return log.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [presentRecords]);


  const avgAttendance = useMemo(() => {
    // This is a placeholder for now as we need total classes to calculate this.
    // For now, we assume 100% for attended classes.
    if (!presentRecords || presentRecords.length === 0) return 0;
    return 100;
  }, [presentRecords]);
  
  const isLoading = isLoadingAttendance || isLoadingClasses;

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
            {isLoadingClasses ? <Skeleton className="h-8 w-1/2" /> : <div className="text-2xl font-bold">{enrolledClasses?.length || 0}</div>}
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
                  {dailyLog.length > 0 ? (
                    dailyLog.map((record) => (
                      <TableRow key={record.id}>
                        <TableCell className="font-medium">
                          {format(parseISO(record.date), "MMMM d, yyyy")}
                        </TableCell>
                        <TableCell>{record.className}</TableCell>
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
