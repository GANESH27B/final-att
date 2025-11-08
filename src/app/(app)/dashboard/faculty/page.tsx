

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
    if (!attendanceRecords || attendanceRecords.length === 0) {
      return { avgAttendance: 0 };
    }

    const attendanceByDate: { [date: string]: { present: number, total: number } } = {};
    const studentCountPerDate: { [date: string]: Set<string> } = {};


    attendanceRecords.forEach(record => {
      const date = record.date;
      if (!attendanceByDate[date]) {
        attendanceByDate[date] = { present: 0, total: 0 };
        studentCountPerDate[date] = new Set();
      }
      
      studentCountPerDate[date].add(record.studentId);

      if (record.status === 'Present') {
        attendanceByDate[date].present++;
      }
    });

    Object.keys(attendanceByDate).forEach(date => {
        attendanceByDate[date].total = studentCountPerDate[date].size;
    });

    const dailyPercentages = Object.values(attendanceByDate)
        .filter(daily => daily.total > 0)
        .map(daily => (daily.present / daily.total) * 100);

    const avgAttendance = dailyPercentages.length > 0 
      ? dailyPercentages.reduce((a, b) => a + b, 0) / dailyPercentages.length 
      : 0;

    return {
      avgAttendance,
    };
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
    </div>
  );
}
