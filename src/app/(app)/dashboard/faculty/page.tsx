"use client"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Users, BookOpen, Percent } from "lucide-react";
import { useCollection, useFirestore, useUser, useMemoFirebase } from "@/firebase";
import { collection, collectionGroup, query, where, getDocs } from "firebase/firestore";
import { Class, User as UserType, AttendanceRecord } from "@/lib/types";
import { useMemo, useState, useEffect } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { ChartContainer, ChartTooltipContent } from "@/components/ui/chart";
import { BarChart, Bar, CartesianGrid, XAxis, YAxis, Tooltip, LineChart, Line } from "recharts";
import { format, parseISO } from 'date-fns';


const chartConfig = {
  attendance: {
    label: "Attendance",
    color: "hsl(var(--primary))",
  },
};

export default function FacultyDashboardPage() {
  const firestore = useFirestore();
  const { user: currentUser } = useUser();

  // 1. Fetch classes for the current faculty
  const facultyClassesQuery = useMemoFirebase(() => 
    firestore && currentUser ? query(collection(firestore, 'classes'), where('facultyId', '==', currentUser.uid)) : null,
    [firestore, currentUser]
  );
  const { data: facultyClasses, isLoading: isLoadingClasses } = useCollection<Class>(facultyClassesQuery);

  // 2. Fetch all attendance records for this faculty's classes
  const facultyAttendanceQuery = useMemoFirebase(() => 
    firestore && currentUser ? query(collectionGroup(firestore, 'attendance'), where('facultyId', '==', currentUser.uid)) : null,
    [firestore, currentUser]
  );
  const { data: attendanceRecords, isLoading: isLoadingAttendance } = useCollection<AttendanceRecord>(facultyAttendanceQuery);

  // 3. Fetch total students
  const [studentCount, setStudentCount] = useState(0);
  const [isLoadingStudents, setIsLoadingStudents] = useState(true);

  useEffect(() => {
    if (facultyClasses && firestore) {
      setIsLoadingStudents(true);
      let totalStudents = new Set<string>();

      if (facultyClasses.length === 0) {
        setStudentCount(0);
        setIsLoadingStudents(false);
        return;
      }

      const fetchStudentsPromises = facultyClasses.map(cls => {
        const studentsCollectionRef = collection(firestore, 'classes', cls.id, 'students');
        return getDocs(studentsCollectionRef);
      });

      Promise.all(fetchStudentsPromises)
        .then(snapshots => {
          snapshots.forEach(snapshot => {
            snapshot.forEach(doc => totalStudents.add(doc.id));
          });
          setStudentCount(totalStudents.size);
        })
        .finally(() => setIsLoadingStudents(false));
    } else if (!isLoadingClasses) {
      // If there are no classes, we are done loading.
      setIsLoadingStudents(false);
      setStudentCount(0);
    }
  }, [facultyClasses, firestore, isLoadingClasses]);


  // 4. Calculate stats
  const stats = useMemo(() => {
    const totalClasses = facultyClasses?.length || 0;
    
    if (!attendanceRecords || attendanceRecords.length === 0) {
      return { avgAttendance: 0 };
    }

    const presentCount = attendanceRecords.filter(a => a.status === 'Present').length;
    const avgAttendance = (presentCount / attendanceRecords.length) * 100;

    return {
      avgAttendance,
    };
  }, [facultyClasses, attendanceRecords]);

  // 5. Calculate data for charts
   const myClassAttendanceData = useMemo(() => {
    if (!facultyClasses || !attendanceRecords || facultyClasses.length === 0) return [];

    const classAttendance = facultyClasses.map(cls => {
        const relevantAttendance = attendanceRecords.filter(a => a.classId === cls.id);
        if (relevantAttendance.length === 0) {
            return { name: cls.name, attendance: 0 };
        }
        const presentCount = relevantAttendance.filter(a => a.status === 'Present').length;
        const avg = (presentCount / relevantAttendance.length) * 100;
        return { name: cls.name, attendance: parseFloat(avg.toFixed(1)) };
    });
    
    return classAttendance;

  }, [facultyClasses, attendanceRecords]);

  const overallAttendanceData = useMemo(() => {
    if (!attendanceRecords || attendanceRecords.length === 0) return [];

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


  const isLoading = isLoadingClasses || isLoadingAttendance || isLoadingStudents;

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold tracking-tight font-headline">Faculty Dashboard</h1>
      <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
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
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg. Attendance</CardTitle>
            <Percent className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? <Skeleton className="h-8 w-1/2" /> : <div className="text-2xl font-bold">{stats.avgAttendance.toFixed(1)}%</div>}
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
                    myClassAttendanceData.length > 0 ? (
                        <ChartContainer config={chartConfig} className="min-h-[250px] w-full">
                            <BarChart data={myClassAttendanceData} accessibilityLayer>
                               <CartesianGrid vertical={false} />
                               <XAxis dataKey="name" tickLine={false} tickMargin={10} axisLine={false} tickFormatter={(value) => value.slice(0, 6)} />
                               <YAxis domain={[0, 100]} />
                               <Tooltip cursor={false} content={<ChartTooltipContent />} />
                               <Bar dataKey="attendance" fill="hsl(var(--primary))" radius={8} />
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
                                <YAxis domain={[0, 100]} />
                                <Tooltip cursor={false} content={<ChartTooltipContent />} />
                                <Line type="monotone" dataKey="attendance" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
                            </LineChart>
                        </ChartContainer>
                    ) : (
                         <div className="flex h-[250px] w-full items-center justify-center text-muted-foreground">
                            No trend data available.
                        </div>
                    )
                )}
            </CardContent>
        </Card>
      </div>
    </div>
  );
}
