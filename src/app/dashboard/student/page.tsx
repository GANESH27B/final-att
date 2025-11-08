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
import { collection, query, where, getDocs } from "firebase/firestore";
import { Class, AttendanceRecord } from "@/lib/types";
import { useMemo, useState, useEffect } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { format, parseISO } from "date-fns";

type CombinedAttendanceRecord = {
  id: string;
  className: string;
  date: string;
  status: "Present" | "Absent";
};

export default function StudentDashboardPage() {
  const firestore = useFirestore();
  const { user } = useUser();

  const [allSessions, setAllSessions] = useState<CombinedAttendanceRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // 1. Get all classes the student is enrolled in.
  const enrolledClassesQuery = useMemoFirebase(
    () => 
      firestore && user 
      ? query(collection(firestore, 'classes'), where('studentIds', 'array-contains', user.uid))
      : null, 
    [firestore, user]
  );
  const { data: enrolledClasses, isLoading: isLoadingClasses } = useCollection<Class>(enrolledClassesQuery);

  // 2. Get all of the student's "Present" attendance records.
  const studentAttendanceQuery = useMemoFirebase(
    () =>
      firestore && user
        ? query(collection(firestore, `users/${user.uid}/attendance`), where('status', '==', 'Present'))
        : null,
    [firestore, user]
  );
  const { data: presentRecords, isLoading: isLoadingAttendance } = useCollection<AttendanceRecord>(studentAttendanceQuery);


  useEffect(() => {
    if (isLoadingClasses || isLoadingAttendance) {
        setIsLoading(true);
        return;
    }
    
    if (!enrolledClasses || !firestore || !user) {
        setIsLoading(false);
        setAllSessions([]);
        return;
    }

    const fetchAllClassSessions = async () => {
        setIsLoading(true);
        const allClassSessions: CombinedAttendanceRecord[] = [];
        const studentPresentRecordsMap = new Map(presentRecords?.map(r => `${r.classId}-${r.date}`));

        for (const cls of enrolledClasses) {
            // Get all attendance documents for this class to find all unique session dates
            const classAttendanceQuery = query(collection(firestore, `classes/${cls.id}/attendance`));
            const classAttendanceSnap = await getDocs(classAttendanceQuery);
            
            const sessionDates = new Set<string>();
            classAttendanceSnap.forEach(doc => {
                sessionDates.add(doc.data().date);
            });
            
            sessionDates.forEach(date => {
                const sessionKey = `${cls.id}-${date}`;
                const isPresent = studentPresentRecordsMap.has(sessionKey);
                allClassSessions.push({
                    id: sessionKey,
                    className: cls.name,
                    date: date,
                    status: isPresent ? 'Present' : 'Absent',
                });
            });
        }
        
        // Sort sessions by date, most recent first
        allClassSessions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        setAllSessions(allClassSessions);
        setIsLoading(false);
    };

    fetchAllClassSessions();

  }, [enrolledClasses, presentRecords, firestore, user, isLoadingClasses, isLoadingAttendance]);
  
  const stats = useMemo(() => {
    if (isLoading || allSessions.length === 0) {
      return {
        totalClasses: enrolledClasses?.length || 0,
        overallPercentage: 0,
      };
    }

    const presentCount = allSessions.filter(r => r.status === 'Present').length;
    const totalSessions = allSessions.length;
    
    return {
      totalClasses: enrolledClasses?.length || 0,
      overallPercentage: totalSessions > 0 ? (presentCount / totalSessions) * 100 : 0,
    };
  }, [allSessions, enrolledClasses, isLoading]);

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
            {isLoadingClasses ? (
              <Skeleton className="h-8 w-1/4" />
            ) : (
              <div className="text-2xl font-bold">{stats.totalClasses}</div>
            )}
            <p className="text-xs text-muted-foreground">All your subjects this semester.</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Overall Attendance</CardTitle>
            <Percent className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-1/4" />
            ) : (
              <div className="text-2xl font-bold">{stats.overallPercentage.toFixed(1)}%</div>
            )}
            <p className="text-xs text-muted-foreground">Across all your classes.</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Daily Attendance Log</CardTitle>
          <CardDescription>Your day-to-day attendance record for all classes.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Class</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-40" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-16" /></TableCell>
                  </TableRow>
                ))
              ) : allSessions.length > 0 ? (
                allSessions.map((record) => (
                  <TableRow key={record.id}>
                    <TableCell>
                      {format(parseISO(record.date), "PPP")}
                    </TableCell>
                    <TableCell>{record.className}</TableCell>
                    <TableCell>
                      <Badge variant={record.status === "Present" ? "secondary" : "destructive"}>
                        {record.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={3} className="text-center text-muted-foreground">
                    No attendance records found.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
