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
import { collection, query, where, collectionGroup, getDocs } from "firebase/firestore";
import { AttendanceRecord, Class, User } from "@/lib/types";
import { useMemo, useEffect, useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { format, parseISO } from "date-fns";

type DailyLogEntry = {
  id: string;
  date: string;
  className: string;
  status: "Present" | "Absent";
};

export default function StudentDashboardPage() {
  const firestore = useFirestore();
  const { user } = useUser();
  const [dailyLog, setDailyLog] = useState<DailyLogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // 1. Get all classes the student is enrolled in.
  const enrolledClassesQuery = useMemoFirebase(() =>
    firestore && user ? query(collectionGroup(firestore, 'students'), where('studentId', '==', user.uid)) : null,
    [firestore, user]
  );
  const { data: enrolledClasses, isLoading: isLoadingEnrolled } = useCollection<Class>(enrolledClassesQuery);

  // 2. Get all personal attendance records.
  const studentAttendanceQuery = useMemoFirebase(() => 
    firestore && user ? query(collection(firestore, `users/${user.uid}/attendance`)) : null,
    [firestore, user]
  );
  const { data: presentRecords, isLoading: isLoadingAttendance } = useCollection<AttendanceRecord>(studentAttendanceQuery);

  useEffect(() => {
    const generateFullAttendanceLog = async () => {
      if (!firestore || !enrolledClasses || presentRecords === null) {
        if (!isLoadingEnrolled && !isLoadingAttendance) {
          setIsLoading(false);
        }
        return;
      }

      setIsLoading(true);

      // Create a map of all "Present" records for quick lookup.
      const presentMap = new Map(presentRecords.map(r => `${r.classId}-${r.date}`));

      // Fetch all attendance sessions for the classes the student is enrolled in.
      const allClassAttendance: AttendanceRecord[] = [];
      if (enrolledClasses.length > 0) {
        const classIds = enrolledClasses.map(c => c.classId);
        const attendanceQuery = query(collectionGroup(firestore, 'attendance'), where('classId', 'in', classIds));
        const attendanceSnap = await getDocs(attendanceQuery);
        attendanceSnap.forEach(doc => {
          allClassAttendance.push({ id: doc.id, ...doc.data() } as AttendanceRecord);
        });
      }

      // Create a set of unique class sessions (classId + date).
      const allSessions = new Map<string, { className: string, date: string, classId: string }>();
      allClassAttendance.forEach(rec => {
        const sessionKey = `${rec.classId}-${rec.date}`;
        if (!allSessions.has(sessionKey)) {
          allSessions.set(sessionKey, { className: rec.className || "Unknown Class", date: rec.date, classId: rec.classId });
        }
      });
      
      const fullLog: DailyLogEntry[] = [];
      allSessions.forEach((session, key) => {
        const isPresent = presentMap.has(key);
        fullLog.push({
          id: key,
          date: session.date,
          className: session.className,
          status: isPresent ? "Present" : "Absent",
        });
      });
      
      // Sort the final log by date, most recent first.
      const sortedLog = fullLog.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

      setDailyLog(sortedLog);
      setIsLoading(false);
    };

    generateFullAttendanceLog();
  }, [firestore, enrolledClasses, presentRecords, isLoadingEnrolled, isLoadingAttendance]);

  
  const avgAttendance = useMemo(() => {
    if (dailyLog.length === 0) return 0;
    const presentCount = dailyLog.filter(r => r.status === 'Present').length;
    return (presentCount / dailyLog.length) * 100;
  }, [dailyLog]);

  const totalEnrolledClasses = useMemo(() => {
    return enrolledClasses?.length || 0;
  }, [enrolledClasses]);

  const finalIsLoading = isLoading || isLoadingEnrolled;

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
            {isLoadingEnrolled ? <Skeleton className="h-8 w-1/2" /> : <div className="text-2xl font-bold">{totalEnrolledClasses}</div>}
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
            {finalIsLoading ? <Skeleton className="h-8 w-1/2" /> : <div className="text-2xl font-bold">{avgAttendance.toFixed(1)}%</div>}
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
           {finalIsLoading ? (
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
