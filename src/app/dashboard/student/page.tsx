
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
import { AttendanceRecord, Class } from "@/lib/types";
import { useMemo, useState, useEffect } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { format, parseISO } from "date-fns";

type CombinedAttendanceRecord = {
  id: string;
  date: string;
  className: string;
  status: 'Present' | 'Absent';
};

export default function StudentDashboardPage() {
  const firestore = useFirestore();
  const { user } = useUser();

  const [allSessions, setAllSessions] = useState<CombinedAttendanceRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // 1. Get all classes the student is enrolled in
  const enrolledClassesQuery = useMemoFirebase(() =>
    firestore && user ? query(collection(firestore, 'classes'), where('studentIds', 'array-contains', user.uid)) : null,
    [firestore, user]
  );
  const { data: enrolledClasses, isLoading: isLoadingClasses } = useCollection<Class>(enrolledClassesQuery);

  // 2. Get all of the student's own ("Present") attendance records
  const studentAttendanceQuery = useMemoFirebase(() =>
    firestore && user ? query(collection(firestore, `users/${user.uid}/attendance`)) : null,
    [firestore, user]
  );
  const { data: presentRecords, isLoading: isLoadingPresent } = useCollection<AttendanceRecord>(studentAttendanceQuery);

  // 3. Combine and calculate full attendance history
  useEffect(() => {
    if (isLoadingClasses || isLoadingPresent || !firestore) {
      if(!isLoadingClasses && !isLoadingPresent){
        setIsLoading(false);
      }
      return;
    }
    
    setIsLoading(true);

    const fetchAllClassSessions = async () => {
        if (!enrolledClasses || enrolledClasses.length === 0) {
            setAllSessions([]);
            setIsLoading(false);
            return;
        }

        const sessionPromises = enrolledClasses.map(async (cls) => {
            const classAttendanceQuery = query(collection(firestore, `classes/${cls.id}/attendance`));
            const snapshot = await getDocs(classAttendanceQuery);
            return {
                classId: cls.id,
                className: cls.name,
                sessions: snapshot.docs.map(doc => ({ ...doc.data() as AttendanceRecord, id: doc.id }))
            };
        });
        
        const results = await Promise.all(sessionPromises);

        const allClassSessions = new Map<string, { className: string }>(); // key: 'classId-date'
        results.forEach(classResult => {
            classResult.sessions.forEach(session => {
                const sessionKey = `${classResult.classId}-${session.date}`;
                if(!allClassSessions.has(sessionKey)) {
                   allClassSessions.set(sessionKey, { className: classResult.className });
                }
            });
        });
        
        const presentSet = new Set(presentRecords?.map(r => `${r.classId}-${r.date}`) || []);

        const combinedRecords: CombinedAttendanceRecord[] = [];
        allClassSessions.forEach(({ className }, key) => {
            const [classId, date] = key.split('-');
            const status = presentSet.has(key) ? 'Present' : 'Absent';
            combinedRecords.push({
                id: key,
                date,
                className,
                status
            });
        });
        
        setAllSessions(combinedRecords);
        setIsLoading(false);
    };

    fetchAllClassSessions();

  }, [enrolledClasses, presentRecords, isLoadingClasses, isLoadingPresent, firestore]);

  const { stats, sortedAttendance } = useMemo(() => {
    if (allSessions.length === 0) {
      return {
        stats: { totalClasses: enrolledClasses?.length || 0, overallPercentage: 0 },
        sortedAttendance: []
      };
    }

    const presentCount = allSessions.filter(r => r.status === 'Present').length;
    const totalSessions = allSessions.length;

    const newStats = {
      totalClasses: enrolledClasses?.length || 0,
      overallPercentage: totalSessions > 0 ? (presentCount / totalSessions) * 100 : 0,
    };

    const sorted = [...allSessions].sort((a, b) => {
        try {
            return new Date(b.date).getTime() - new Date(a.date).getTime();
        } catch (e) {
            return 0;
        }
    });

    return { stats: newStats, sortedAttendance: sorted };
  }, [allSessions, enrolledClasses]);


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
            {isLoading ? (
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
              ) : sortedAttendance.length > 0 ? (
                sortedAttendance.map((record) => (
                  <TableRow key={record.id}>
                    <TableCell>
                      { record.date ? format(parseISO(record.date), "PPP") : 'Invalid Date' }
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
