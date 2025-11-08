
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
  const [enrolledClassesCount, setEnrolledClassesCount] = useState(0);
  const [totalSessionsCount, setTotalSessionsCount] = useState(0);
  const [isLoadingCounts, setIsLoadingCounts] = useState(true);

  const studentAttendanceQuery = useMemoFirebase(() => 
    firestore && user ? query(collection(firestore, `users/${user.uid}/attendance`)) : null,
    [firestore, user]
  );
  const { data: presentRecords, isLoading: isLoadingAttendance } = useCollection<AttendanceRecord>(studentAttendanceQuery);
  
  useEffect(() => {
    const fetchCounts = async () => {
      if (!firestore || !user) {
        setIsLoadingCounts(false);
        return;
      };
      
      setIsLoadingCounts(true);

      // 1. Find all classes the user is enrolled in.
      const enrolledClassesSnap = await getDocs(query(collectionGroup(firestore, 'students'), where('id', '==', user.uid)));
      const enrolledClassIds = enrolledClassesSnap.docs.map(doc => doc.data().classId);
      setEnrolledClassesCount(enrolledClassIds.length);

      if (enrolledClassIds.length === 0) {
        setTotalSessionsCount(0);
        setIsLoadingCounts(false);
        return;
      }
      
      // 2. Fetch all attendance sessions for those classes.
      const sessionPromises = enrolledClassIds.map(classId => 
        getDocs(collection(firestore, `classes/${classId}/attendance`))
      );
      const sessionSnapshots = await Promise.all(sessionPromises);
      
      const uniqueSessions = new Set<string>();
      sessionSnapshots.forEach(snap => {
        snap.forEach(doc => {
            const data = doc.data();
            uniqueSessions.add(`${data.classId}-${data.date}`);
        });
      });
      setTotalSessionsCount(uniqueSessions.size);

      setIsLoadingCounts(false);
    };

    fetchCounts();
  }, [firestore, user]);

  const dailyLog = useMemo(() => {
    if (!presentRecords) return [];

    return presentRecords
        .map(record => ({
            id: record.id,
            date: record.date,
            className: record.className || "Unknown Class",
            status: record.status as "Present" | "Absent",
        }))
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [presentRecords]);


  const avgAttendance = useMemo(() => {
    if (totalSessionsCount === 0) return 0;
    const presentCount = presentRecords?.length || 0;
    return (presentCount / totalSessionsCount) * 100;
  }, [totalSessionsCount, presentRecords]);
  
  const finalIsLoading = isLoadingCounts || isLoadingAttendance;

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
            {finalIsLoading ? <Skeleton className="h-8 w-1/2" /> : <div className="text-2xl font-bold">{enrolledClassesCount}</div>}
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
