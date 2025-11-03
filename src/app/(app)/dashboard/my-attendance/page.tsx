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
import { collectionGroup, query, where } from "firebase/firestore";
import { AttendanceRecord } from "@/lib/types";
import { useMemo } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { format, parseISO } from "date-fns";

const chartConfig = {
  attendance: {
    label: "Attendance",
    color: "hsl(var(--accent))",
  },
}

export default function MyAttendancePage() {
  const firestore = useFirestore();
  const { user } = useUser();

  const studentAttendanceQuery = useMemoFirebase(() => 
    firestore && user ? query(collectionGroup(firestore, 'attendance'), where('studentId', '==', user.uid)) : null,
    [firestore, user]
  );
  const { data: attendanceRecords, isLoading: isLoadingAttendance } = useCollection<AttendanceRecord>(studentAttendanceQuery);
  
  const isLoading = isLoadingAttendance;

  const subjectWiseAttendance = useMemo(() => {
    if (!attendanceRecords) return [];

    const statsByClass: { [classId: string]: { name: string; attended: number; total: number } } = {};
    const uniqueDatesByClass: { [classId: string]: Set<string> } = {};

    attendanceRecords.forEach(record => {
      // Initialize if not present
      if (!uniqueDatesByClass[record.classId]) uniqueDatesByClass[record.classId] = new Set();
      if (!statsByClass[record.classId]) {
        statsByClass[record.classId] = { 
            name: record.className || `Class ${record.classId.slice(0,4)}`,
            attended: 0, 
            total: 0 
        };
      }
      
      uniqueDatesByClass[record.classId].add(record.date);
      if (record.status === 'Present') {
        statsByClass[record.classId].attended++;
      }
    });

    // Set total classes based on unique dates attended, not total records
    for (const classId in uniqueDatesByClass) {
        if(statsByClass[classId]) {
            statsByClass[classId].total = uniqueDatesByClass[classId].size;
        }
    }

    return Object.values(statsByClass).map(stats => {
      const percentage = stats.total > 0 ? (stats.attended / stats.total) * 100 : 0;
      return {
        subject: stats.name,
        totalClasses: stats.total,
        attendedClasses: stats.attended,
        percentage: parseFloat(percentage.toFixed(1)),
      };
    });
  }, [attendanceRecords]);
  
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
    const uniqueDaysByMonth: { [key: string]: Set<string> } = {};

    attendanceRecords.forEach(record => {
        try {
          const month = format(parseISO(record.date), 'MMM');
          if (!uniqueDaysByMonth[month]) uniqueDaysByMonth[month] = new Set();
          uniqueDaysByMonth[month].add(record.date);

          if (!attendanceByMonth[month]) attendanceByMonth[month] = { present: 0, total: 0 };
          if (record.status === 'Present') {
              attendanceByMonth[month].present++;
          }
        } catch(e) { /* ignore invalid dates */ }
    });

    for (const month in uniqueDaysByMonth) {
        if(attendanceByMonth[month]) {
            attendanceByMonth[month].total = uniqueDaysByMonth[month].size;
        }
    }

    const monthOrder = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

    return monthOrder
        .filter(month => attendanceByMonth[month])
        .map(month => {
            const { present, total } = attendanceByMonth[month];
            const percentage = total > 0 ? (present / total) * 100 : 0;
            return { date: month, attendance: parseFloat(percentage.toFixed(1)) };
        });

  }, [attendanceRecords]);


  if (isLoading) {
    return (
        <div className="space-y-4">
            <h1 className="text-2xl font-bold tracking-tight font-headline">My Attendance</h1>
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
        <h1 className="text-2xl font-bold tracking-tight font-headline">My Attendance</h1>
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
                Out of {overallStats.totalClasses} total classes held.
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Subject-wise Attendance</CardTitle>
            <CardDescription>Detailed attendance record for each subject.</CardDescription>
          </CardHeader>
          <CardContent>
             {subjectWiseAttendance.length > 0 ? (
                <Table>
                    <TableHeader>
                        <TableRow>
                        <TableHead className="w-[120px] sm:w-[180px]">Subject</TableHead>
                        <TableHead>Progress</TableHead>
                        <TableHead className="text-right">Percentage</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {subjectWiseAttendance.map((subject) => (
                        <TableRow key={subject.subject}>
                            <TableCell className="font-medium truncate">{subject.subject}</TableCell>
                            <TableCell>
                            <Progress value={subject.percentage} className="h-2" />
                            </TableCell>
                            <TableCell className="text-right">{subject.percentage}%</TableCell>
                        </TableRow>
                        ))}
                    </TableBody>
                </Table>
             ) : (
                <div className="text-center text-muted-foreground p-8 border-dashed border-2 rounded-md">
                    <p>No attendance records found yet.</p>
                </div>
             )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Attendance Progress</CardTitle>
            <CardDescription>Your attendance trend over the last few months.</CardDescription>
          </CardHeader>
          <CardContent>
            {monthlyTrendData.length > 0 ? (
              <ChartContainer config={chartConfig} className="min-h-[200px] w-full">
                  <LineChart data={monthlyTrendData} accessibilityLayer margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                    <CartesianGrid vertical={false} />
                    <XAxis dataKey="date" tickLine={false} tickMargin={10} axisLine={false} />
                    <YAxis domain={[0, 100]} />
                    <Tooltip cursor={false} content={<ChartTooltipContent />} />
                    <Line type="monotone" dataKey="attendance" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ fill: "hsl(var(--primary))" }} activeDot={{ r: 6 }} />
                  </LineChart>
              </ChartContainer>
            ) : (
                 <div className="text-center text-muted-foreground p-8 border-dashed border-2 rounded-md">
                    <p>Not enough data for a trend graph.</p>
                </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

    