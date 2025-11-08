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
import { Progress } from "@/components/ui/progress";
import { LineChart, CartesianGrid, XAxis, YAxis, Tooltip, Line } from "recharts";
import { ChartContainer, ChartTooltipContent } from "@/components/ui/chart";
import { useCollection, useFirestore, useUser, useMemoFirebase } from "@/firebase";
import { collection, query, where } from "firebase/firestore";
import { AttendanceRecord, Class, User } from "@/lib/types";
import { useMemo } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { format, parseISO } from "date-fns";

const chartConfig = {
  attendance: {
    label: "Attendance",
    color: "hsl(var(--accent))",
  },
}

export default function StudentDashboardPage() {
  const firestore = useFirestore();
  const { user } = useUser();

  const studentAttendanceQuery = useMemoFirebase(() => 
    firestore && user ? collection(firestore, `users/${user.uid}/attendance`) : null,
    [firestore, user]
  );
  const { data: attendanceRecords, isLoading: isLoadingAttendance } = useCollection<AttendanceRecord>(studentAttendanceQuery);
  
  const enrolledClassIds = useMemo(() => {
    if (!attendanceRecords) return [];
    return [...new Set(attendanceRecords.map(r => r.classId))];
  }, [attendanceRecords]);
  
  const classesQuery = useMemoFirebase(() => {
    if (!firestore || enrolledClassIds.length === 0) return null;
    return query(collection(firestore, 'classes'), where('id', 'in', enrolledClassIds));
  }, [firestore, enrolledClassIds]);

  const { data: enrolledClasses, isLoading: isLoadingClasses } = useCollection<Class>(classesQuery);

  const isLoading = isLoadingAttendance || (enrolledClassIds.length > 0 && isLoadingClasses);

  const classMap = useMemo(() => {
    if (!enrolledClasses) return new Map<string, Class>();
    return new Map(enrolledClasses.map(c => [c.id, c]));
  }, [enrolledClasses]);


  const subjectWiseAttendance = useMemo(() => {
    if (!attendanceRecords || !classMap.size) return [];

    const statsByClass: { [classId: string]: { attended: number, total: number } } = {};

    attendanceRecords.forEach(record => {
      if (!statsByClass[record.classId]) {
        statsByClass[record.classId] = { attended: 0, total: 0 };
      }
      statsByClass[record.classId].total++;
      if (record.status === 'Present') {
        statsByClass[record.classId].attended++;
      }
    });

    return Object.entries(statsByClass).map(([classId, stats]) => {
      const classInfo = classMap.get(classId);
      const percentage = stats.total > 0 ? (stats.attended / stats.total) * 100 : 0;
      return {
        subject: classInfo?.name || 'Unknown Class',
        totalClasses: stats.total,
        attendedClasses: stats.attended,
        percentage: parseFloat(percentage.toFixed(1)),
      };
    });
  }, [attendanceRecords, classMap]);
  
  const overallStats = useMemo(() => {
    if (subjectWiseAttendance.length === 0) {
      return {
        overallPercentage: 0,
        totalAttended: 0,
        totalClasses: 0,
        lowestAttendanceSubject: { subject: 'N/A', percentage: 0 },
      };
    }

    const totalAttended = subjectWiseAttendance.reduce((acc, curr) => acc + curr.attendedClasses, 0);
    const totalClasses = subjectWiseAttendance.reduce((acc, curr) => acc + curr.totalClasses, 0);
    const overallPercentage = totalClasses > 0 ? (totalAttended / totalClasses) * 100 : 0;
    
    const lowestAttendanceSubject = [...subjectWiseAttendance].sort((a,b) => a.percentage - b.percentage)[0] || { subject: 'N/A', percentage: 0 };

    return {
      overallPercentage: parseFloat(overallPercentage.toFixed(1)),
      totalAttended,
      totalClasses,
      lowestAttendanceSubject,
    };
  }, [subjectWiseAttendance]);

  const monthlyTrendData = useMemo(() => {
    if (!attendanceRecords) return [];

    const attendanceByMonth: { [key: string]: { present: number, total: number } } = {};

    attendanceRecords.forEach(record => {
      const month = format(parseISO(record.date), 'MMM');
      if (!attendanceByMonth[month]) {
        attendanceByMonth[month] = { present: 0, total: 0 };
      }
      attendanceByMonth[month].total++;
      if (record.status === 'Present') {
        attendanceByMonth[month].present++;
      }
    });
    
    const monthOrder = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

    return monthOrder
        .filter(month => attendanceByMonth[month])
        .map(month => {
            const { present, total } = attendanceByMonth[month];
            return {
                date: month,
                attendance: parseFloat(((present / total) * 100).toFixed(1)),
            };
        });

  }, [attendanceRecords]);

  if (isLoading) {
    return (
        <div className="space-y-4">
            <h1 className="text-2xl font-bold tracking-tight font-headline">Student Dashboard</h1>
            <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
                {Array.from({length: 3}).map((_, i) => (
                    <Card key={i}><CardHeader className="pb-2"><Skeleton className="h-4 w-1/2" /><Skeleton className="h-10 w-1/4 mt-1" /></CardHeader><CardContent><Skeleton className="h-3 w-3/4" /></CardContent></Card>
                ))}
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <Card>
                    <CardHeader><CardTitle>Subject-wise Attendance</CardTitle><CardDescription>Detailed attendance record for each subject.</CardDescription></CardHeader>
                    <CardContent><Skeleton className="h-48 w-full" /></CardContent>
                </Card>
                <Card>
                    <CardHeader><CardTitle>Attendance Progress</CardTitle><CardDescription>Your attendance trend over the last few months.</CardDescription></CardHeader>
                    <CardContent><Skeleton className="h-48 w-full" /></CardContent>
                </Card>
            </div>
        </div>
    )
  }

  return (
    <div className="space-y-4">
        <h1 className="text-2xl font-bold tracking-tight font-headline">Student Dashboard</h1>
      <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Overall Attendance</CardDescription>
            <CardTitle className="text-4xl">{overallStats.overallPercentage}%</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xs text-muted-foreground">
              {overallStats.overallPercentage >= 75 ? "You are on track. Keep it up!" : "Your attendance is low. Try to attend more classes."}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Classes Attended</CardDescription>
            <CardTitle className="text-4xl">{overallStats.totalAttended}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xs text-muted-foreground">
                Out of {overallStats.totalClasses} total classes.
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Lowest Attendance</CardDescription>
            <CardTitle className="text-4xl">{overallStats.lowestAttendanceSubject.percentage}%</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xs text-muted-foreground">
                in {overallStats.lowestAttendanceSubject.subject}
            </div>
          </CardContent>
        </Card>
      </div>

    </div>
  );
}
