
"use client"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { BarChart, LineChart } from "recharts";
import { Users, BookOpen, Percent, TrendingUp } from "lucide-react";
import { ChartContainer, ChartTooltipContent } from "@/components/ui/chart";
import { Bar, CartesianGrid, XAxis, YAxis, Tooltip, Line } from "recharts";
import { useCollection, useFirestore, useUser, useMemoFirebase } from "@/firebase";
import { collection, query, where, getDocs, collectionGroup } from "firebase/firestore";
import { Class, User as UserType, AttendanceRecord } from "@/lib/types";
import { useMemo, useState, useEffect, useCallback } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { format, parseISO, startOfToday, isFuture } from 'date-fns';

const chartConfig = {
  attendance: {
    label: "Attendance",
    color: "hsl(var(--accent))",
  },
};

export default function FacultyDashboardPage() {
    const firestore = useFirestore();
    const { user } = useUser();

    const facultyClassesQuery = useMemoFirebase(() => 
        firestore && user ? query(collection(firestore, 'classes'), where('facultyId', '==', user.uid)) : null,
        [firestore, user]
    );

    const { data: myClasses, isLoading: isLoadingClasses } = useCollection<Class>(facultyClassesQuery);

    const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
    const [isLoadingAttendance, setIsLoadingAttendance] = useState(true);

    const fetchAttendanceForClasses = useCallback(async () => {
        if (!firestore || !myClasses) return;

        setIsLoadingAttendance(true);
        let allAttendance: AttendanceRecord[] = [];
        for (const cls of myClasses) {
            const attendanceRef = collection(firestore, `classes/${cls.id}/attendance`);
            const attendanceSnap = await getDocs(attendanceRef);
            allAttendance.push(...attendanceSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as AttendanceRecord)));
        }
        setAttendance(allAttendance);
        setIsLoadingAttendance(false);
    }, [firestore, myClasses]);

    useEffect(() => {
        if (myClasses) {
            fetchAttendanceForClasses();
        } else if (!isLoadingClasses) {
            setIsLoadingAttendance(false);
        }
    }, [myClasses, isLoadingClasses, fetchAttendanceForClasses]);

    const [studentCount, setStudentCount] = useState(0);
    const [isLoadingStudentCount, setIsLoadingStudentCount] = useState(true);

    const fetchStudentCount = useCallback(async () => {
        if (!firestore || !myClasses) return;
        setIsLoadingStudentCount(true);
        let totalStudents = new Set<string>();

        for (const cls of myClasses) {
            const studentsRef = collection(firestore, `classes/${cls.id}/students`);
            const studentsSnap = await getDocs(studentsRef);
            studentsSnap.forEach(doc => totalStudents.add(doc.id));
        }
        setStudentCount(totalStudents.size);
        setIsLoadingStudentCount(false);

    }, [firestore, myClasses]);

    useEffect(() => {
        if (myClasses) {
            fetchStudentCount();
        }
    }, [myClasses, fetchStudentCount]);

    const isLoading = isLoadingClasses || isLoadingAttendance || isLoadingStudentCount;

    const stats = useMemo(() => {
        if (!myClasses || !attendance) {
            return {
                totalStudents: 0,
                totalClasses: 0,
                avgAttendance: 0,
                upcomingClass: "N/A"
            };
        }

        const totalClasses = myClasses.length;

        const presentCount = attendance.filter(a => a.status === 'Present').length;
        const avgAttendance = attendance.length > 0 ? (presentCount / attendance.length) * 100 : 0;
        
        const upcomingClass = myClasses.length > 0 ? myClasses[0].name : "None";

        return {
            totalStudents: studentCount,
            totalClasses,
            avgAttendance,
            upcomingClass
        };
    }, [myClasses, attendance, studentCount]);
    
    const myClassAttendanceData = useMemo(() => {
        if (!myClasses || !attendance || myClasses.length === 0) return [];
    
        const classAttendance = myClasses.map((cls, index) => {
            const relevantAttendance = attendance.filter(a => a.classId === cls.id);
            if (relevantAttendance.length === 0) {
                return { name: cls.name, attendance: 0, fill: `hsl(var(--chart-${(index % 5) + 1}))` };
            }
            const presentCount = relevantAttendance.filter(a => a.status === 'Present').length;
            const avg = (presentCount / relevantAttendance.length) * 100;
            const fill = `hsl(var(--chart-${(index % 5) + 1}))`;

            const key = cls.name.replace(/\s+/g, '').toLowerCase();
            if (!chartConfig[key as keyof typeof chartConfig]) {
                (chartConfig as any)[key] = { label: cls.name, color: fill };
            }

            return { name: cls.name, attendance: parseFloat(avg.toFixed(1)), fill };
        });
    
        return classAttendance;
    
    }, [myClasses, attendance]);

    const myOverallAttendanceData = useMemo(() => {
        if (!attendance || attendance.length === 0) return [];

        const attendanceByMonth: { [key: string]: { present: number, total: number } } = {};

        attendance.forEach(record => {
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

    }, [attendance]);


  return (
    <div className="space-y-4">
       <h1 className="text-2xl font-bold tracking-tight font-headline">Faculty Dashboard</h1>
      <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">My Students</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? <Skeleton className="h-8 w-1/2" /> : <div className="text-2xl font-bold">{stats.totalStudents}</div>}
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              across {myClasses?.length || 0} classes
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">My Classes</CardTitle>
            <BookOpen className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? <Skeleton className="h-8 w-1/2" /> : <div className="text-2xl font-bold">{stats.totalClasses}</div>}
             <p className="text-xs text-muted-foreground">
              This semester
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg. Attendance</CardTitle>
            <Percent className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? <Skeleton className="h-8 w-1/2" /> : <div className="text-2xl font-bold">{stats.avgAttendance.toFixed(1)}%</div>}
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              Across all your classes
            </p>
          </CardContent>
        </Card>
         <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Upcoming Classes</CardTitle>
            <BookOpen className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
             {isLoading ? <Skeleton className="h-8 w-1/2" /> : <div className="text-2xl font-bold">{stats.upcomingClass}</div>}
            <p className="text-xs text-muted-foreground">Today at 10:00 AM</p>
          </CardContent>
        </Card>
      </div>
      <div className="grid gap-4 grid-cols-1 lg:grid-cols-7">
        <Card className="lg:col-span-4">
          <CardHeader>
            <CardTitle>My Class Attendance</CardTitle>
            <CardDescription>
              Average attendance percentage for your classes.
            </CardDescription>
          </CardHeader>
          <CardContent>
             {isLoading ? <Skeleton className="h-[250px] w-full" /> : (
             <ChartContainer config={chartConfig} className="min-h-[250px] w-full">
                <BarChart data={myClassAttendanceData} accessibilityLayer>
                   <CartesianGrid vertical={false} />
                   <XAxis dataKey="name" tickLine={false} tickMargin={10} axisLine={false} tickFormatter={(value) => value.slice(0, 6)} />
                   <YAxis domain={[0, 100]} />
                   <Tooltip cursor={false} content={<ChartTooltipContent />} />
                   <Bar dataKey="attendance" radius={8} />
                </BarChart>
             </ChartContainer>
             )}
          </CardContent>
        </Card>
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle>Overall Attendance Trend</CardTitle>
            <CardDescription>Your students' monthly attendance trend.</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? <Skeleton className="h-[250px] w-full" /> : (
            <ChartContainer config={chartConfig} className="min-h-[250px] w-full">
                <LineChart data={myOverallAttendanceData} accessibilityLayer margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                  <CartesianGrid vertical={false} />
                  <XAxis dataKey="date" tickLine={false} tickMargin={10} axisLine={false} />
                  <YAxis domain={[0, 100]} />
                  <Tooltip cursor={false} content={<ChartTooltipContent />} />
                  <Line type="monotone" dataKey="attendance" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
                </LineChart>
            </ChartContainer>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
