
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
import { collection, query, where, getDocs, collectionGroup } from "firebase/firestore";
import { AttendanceRecord, Class, User } from "@/lib/types";
import { useMemo, useState, useEffect } from "react";
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

  const [enrolledClasses, setEnrolledClasses] = useState<Class[]>([]);
  const [allSessions, setAllSessions] = useState<Map<string, { className: string, date: string, classId: string }>>(new Map());
  const [dailyLog, setDailyLog] = useState<CombinedLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const studentAttendanceQuery = useMemoFirebase(() => 
    firestore && user ? query(collection(firestore, `users/${user.uid}/attendance`)) : null,
    [firestore, user]
  );
  const { data: presentRecords, isLoading: isLoadingAttendance } = useCollection<AttendanceRecord>(studentAttendanceQuery);
  
  // 1. Find all classes the student is enrolled in
  useEffect(() => {
    if (!firestore || !user) return;

    setIsLoading(true);
    const classes: Class[] = [];
    const studentEnrollmentQuery = query(collectionGroup(firestore, 'students'), where('studentId', '==', user.uid));
    
    getDocs(studentEnrollmentQuery).then(enrollmentSnap => {
      const classIds = enrollmentSnap.docs.map(doc => doc.data().classId);
      if (classIds.length === 0) {
        setEnrolledClasses([]);
        setIsLoading(false);
        return;
      }

      const classesQuery = query(collection(firestore, 'classes'), where('__name__', 'in', classIds));
      getDocs(classesQuery).then(classesSnap => {
        classesSnap.forEach(doc => {
          classes.push({ id: doc.id, ...doc.data() } as Class);
        });
        setEnrolledClasses(classes);
      });
    });
  }, [firestore, user]);

  // 2. Get all historical sessions for enrolled classes
  useEffect(() => {
    if (!firestore || enrolledClasses.length === 0) {
        if (!isLoadingAttendance) setIsLoading(false);
        return;
    };

    const promises = enrolledClasses.map(cls => 
      getDocs(collection(firestore, `classes/${cls.id}/attendance`))
    );

    Promise.all(promises).then(snapshots => {
      const sessionsMap = new Map<string, { className: string, date: string, classId: string }>();
      snapshots.forEach(snapshot => {
        snapshot.forEach(doc => {
          const record = doc.data() as AttendanceRecord;
          const sessionId = `${record.classId}-${record.date}`;
          if (!sessionsMap.has(sessionId)) {
            sessionsMap.set(sessionId, { className: record.className || 'Unknown Class', date: record.date, classId: record.classId });
          }
        });
      });
      setAllSessions(sessionsMap);
    });
  }, [firestore, enrolledClasses, isLoadingAttendance]);

  // 3. Combine sessions and present records to create the final log
  useEffect(() => {
    if (isLoadingAttendance || !allSessions) return;

    const studentPresentMap = new Map<string, boolean>();
    presentRecords?.forEach(r => {
      const sessionId = `${r.classId}-${r.date}`;
      studentPresentMap.set(sessionId, true);
    });
    
    const combinedLog: CombinedLog[] = Array.from(allSessions.values()).map(session => {
      const sessionId = `${session.classId}-${session.date}`;
      const isPresent = studentPresentMap.has(sessionId);
      return {
        id: sessionId,
        className: session.className,
        date: session.date,
        status: isPresent ? "Present" : "Absent",
      };
    });

    combinedLog.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    setDailyLog(combinedLog);
    setIsLoading(false);

  }, [presentRecords, allSessions, isLoadingAttendance]);


  const avgAttendance = useMemo(() => {
    if (dailyLog.length === 0) return 0;
    const presentCount = dailyLog.filter(log => log.status === 'Present').length;
    return (presentCount / dailyLog.length) * 100;
  }, [dailyLog]);
  

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
            {isLoading ? <Skeleton className="h-8 w-1/2" /> : <div className="text-2xl font-bold">{enrolledClasses.length}</div>}
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
