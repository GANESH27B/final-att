"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Users, BookOpen } from "lucide-react";
import { useCollection, useFirestore, useUser, useMemoFirebase } from "@/firebase";
import { collection, query, where, getDocs } from "firebase/firestore";
import { Class, AttendanceRecord } from "@/lib/types";
import { useState, useEffect, useMemo } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { ChartContainer, ChartTooltipContent } from "@/components/ui/chart";
import { BarChart, Bar, CartesianGrid, XAxis, YAxis, Tooltip, LineChart, Line } from "recharts";
import { format, parseISO } from 'date-fns';

const chartConfig = {
  attendance: {
    label: "Attendance",
    color: "hsl(var(--accent))",
  },
};

export default function FacultyDashboardPage() {
  const firestore = useFirestore();
  const { user: currentUser } = useUser();
  
  // States for dashboard stats
  const [studentCount, setStudentCount] = useState(0);
  const [isLoadingStudents, setIsLoadingStudents] = useState(true);
  const [allAttendance, setAllAttendance] = useState<AttendanceRecord[]>([]);
  const [isLoadingAttendance, setIsLoadingAttendance] = useState(true);

  // 1. Fetch classes for the current faculty
  const facultyClassesQuery = useMemoFirebase(() => 
    firestore && currentUser ? query(collection(firestore, 'classes'), where('facultyId', '==', currentUser.uid)) : null,
    [firestore, currentUser]
  );
  const { data: facultyClasses, isLoading: isLoadingClasses } = useCollection<Class>(facultyClassesQuery);

  // 2. Fetch all attendance records for all of the faculty's classes
  useEffect(() => {
    if (facultyClasses && firestore) {
      setIsLoadingAttendance(true);
      if (facultyClasses.length === 0) {
        setAllAttendance([]);
        setIsLoadingAttendance(false);
        return;
      }
      const fetchAttendancePromises = facultyClasses.map(cls => {
        const attendanceCollectionRef = collection(firestore, 'classes', cls.id, 'attendance');
        return getDocs(attendanceCollectionRef);
      });

      Promise.all(fetchAttendancePromises)
        .then(snapshots => {
          const records: AttendanceRecord[] = [];
          snapshots.forEach(snapshot => {
            snapshot.forEach(doc => records.push({ id: doc.id, ...doc.data() } as AttendanceRecord));
          });
          setAllAttendance(records);
        })
        .finally(() => setIsLoadingAttendance(false));

    } else if (!isLoadingClasses) {
        setIsLoadingAttendance(false);
    }
  }, [facultyClasses, firestore, isLoadingClasses]);


  // 3. Fetch total unique students
  useEffect(() => {
    if (facultyClasses && firestore) {
      setIsLoadingStudents(true);
      if (facultyClasses.length === 0) {
        setStudentCount(0);
        setIsLoadingStudents(false);
        return;
      }

      const studentIds = new Set<string>();
      const fetchStudentsPromises = facultyClasses.map(cls => {
        const studentsCollectionRef = collection(firestore, 'classes', cls.id, 'students');
        return getDocs(studentsCollectionRef);
      });

      Promise.all(fetchStudentsPromises)
        .then(snapshots => {
          snapshots.forEach(snapshot => {
            snapshot.forEach(doc => studentIds.add(doc.id));
          });
          setStudentCount(studentIds.size);
        })
        .finally(() => setIsLoadingStudents(false));
    } else if (!isLoadingClasses) {
      setIsLoadingStudents(false);
      setStudentCount(0);
    }
  }, [facultyClasses, firestore, isLoadingClasses]);

  const classAttendanceData = useMemo(() => {
    if (!facultyClasses || !allAttendance || facultyClasses.length === 0) return [];
  
    const classAttendance = facultyClasses.map((cls, index) => {
      const relevantAttendance = allAttendance.filter(a => a.classId === cls.id);
      if (relevantAttendance.length === 0) {
        return { name: cls.name, attendance: 0, fill: `hsl(var(--chart-${(index % 5) + 1}))` };
      }
  
      // Group attendance by date to find individual sessions
      const sessions = relevantAttendance.reduce((acc, record) => {
        const date = record.date;
        if (!acc[date]) {
          acc[date] = { present: 0, total: 0 };
        }
        acc[date].total++;
        if (record.status === 'Present') {
          acc[date].present++;
        }
        return acc;
      }, {} as Record<string, { present: number; total: number }>);
  
      const sessionPercentages = Object.values(sessions).map(
        session => (session.present / session.total) * 100
      );
  
      if (sessionPercentages.length === 0) {
        return { name: cls.name, attendance: 0, fill: `hsl(var(--chart-${(index % 5) + 1}))` };
      }
  
      // Average the percentages of all sessions for the class
      const totalPercentage = sessionPercentages.reduce((sum, p) => sum + p, 0);
      const avg = totalPercentage / sessionPercentages.length;
  
      return { name: cls.name, attendance: parseFloat(avg.toFixed(1)), fill: `hsl(var(--chart-${(index % 5) + 1}))` };
    });
  
    // Update chartConfig dynamically
    classAttendance.forEach((cls, index) => {
        const key = cls.name.replace(/\s+/g, '').toLowerCase();
        if (!chartConfig[key as keyof typeof chartConfig]) {
            (chartConfig as any)[key] = { label: cls.name, color: `hsl(var(--chart-${(index % 5) + 1}))` };
        }
    });
  
    return classAttendance.sort((a, b) => b.attendance - a.attendance);
  
  }, [facultyClasses, allAttendance]);

  const overallAttendanceData = useMemo(() => {
    if (!allAttendance || allAttendance.length === 0) return [];
  
    // Group attendance records by month
    const attendanceByMonth = allAttendance.reduce((acc, record) => {
      try {
        const month = format(parseISO(record.date), 'yyyy-MM');
        if (!acc[month]) {
          acc[month] = [];
        }
        acc[month].push(record);
      } catch (e) {
        // Ignore invalid dates
      }
      return acc;
    }, {} as Record<string, AttendanceRecord[]>);
  
    const monthlyAverages = Object.entries(attendanceByMonth).map(([month, records]) => {
      // For each month, group records by session (classId + date)
      const sessions = records.reduce((acc, record) => {
        const sessionKey = `${record.classId}-${record.date}`;
        if (!acc[sessionKey]) {
          acc[sessionKey] = { present: 0, total: 0 };
        }
        acc[sessionKey].total++;
        if (record.status === 'Present') {
          acc[sessionKey].present++;
        }
        return acc;
      }, {} as Record<string, { present: number, total: number }>);
  
      // Calculate percentage for each session
      const sessionPercentages = Object.values(sessions).map(
        session => (session.present / session.total) * 100
      );
  
      if (sessionPercentages.length === 0) {
        return { date: format(parseISO(month + '-01'), 'MMM'), attendance: 0 };
      }
  
      // Average the percentages of all sessions in that month
      const totalPercentage = sessionPercentages.reduce((sum, p) => sum + p, 0);
      const avg = totalPercentage / sessionPercentages.length;
      return { date: format(parseISO(month + '-01'), 'MMM'), attendance: parseFloat(avg.toFixed(1)) };
    });
    
    // Ensure chronological order
    const monthOrder = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    return monthlyAverages.sort((a,b) => monthOrder.indexOf(a.date) - monthOrder.indexOf(b.date));
  
  }, [allAttendance]);

  const isLoading = isLoadingClasses || isLoadingStudents || isLoadingAttendance;

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold tracking-tight font-headline">Faculty Dashboard</h1>
      <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">My Classes</CardTitle>
            <BookOpen className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? <Skeleton className="h-8 w-1/2" /> : <div className="text-2xl font-bold">{facultyClasses?.length || 0}</div>}
            <p className="text-xs text-muted-foreground">This semester</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Students</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? <Skeleton className="h-8 w-1/2" /> : <div className="text-2xl font-bold">{studentCount}</div>}
            <p className="text-xs text-muted-foreground">Across all your classes</p>
          </CardContent>
        </Card>
      </div>

       <div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>My Class Attendance</CardTitle>
            <CardDescription>Average attendance percentage for your classes.</CardDescription>
          </CardHeader>
          <CardContent>
             {isLoading ? <Skeleton className="h-[250px] w-full" /> : (
                classAttendanceData.length > 0 ? (
                    <ChartContainer config={chartConfig} className="min-h-[250px] w-full">
                        <BarChart data={classAttendanceData} accessibilityLayer>
                           <CartesianGrid vertical={false} />
                           <XAxis dataKey="name" tickLine={false} tickMargin={10} axisLine={false} tickFormatter={(value) => value.slice(0, 6)} />
                           <YAxis domain={[0, 100]} unit="%" />
                           <Tooltip cursor={false} content={<ChartTooltipContent />} />
                           <Bar dataKey="attendance" radius={8} />
                        </BarChart>
                    </ChartContainer>
                ) : (
                    <div className="flex h-[250px] w-full items-center justify-center text-muted-foreground">
                        No attendance data to display.
                    </div>
                )
             )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Overall Attendance Trend</CardTitle>
            <CardDescription>Your students' monthly attendance trend.</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? <Skeleton className="h-[250px] w-full" /> : (
                overallAttendanceData.length > 0 ? (
                    <ChartContainer config={chartConfig} className="min-h-[250px] w-full">
                        <LineChart data={overallAttendanceData} accessibilityLayer margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                          <CartesianGrid vertical={false} />
                          <XAxis dataKey="date" tickLine={false} tickMargin={10} axisLine={false} />
                          <YAxis domain={[0, 100]} unit="%" />
                          <Tooltip cursor={false} content={<ChartTooltipContent />} />
                          <Line type="monotone" dataKey="attendance" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
                        </LineChart>
                    </ChartContainer>
                ) : (
                     <div className="flex h-[250px] w-full items-center justify-center text-muted-foreground">
                        Not enough data for a trend graph.
                    </div>
                )
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
