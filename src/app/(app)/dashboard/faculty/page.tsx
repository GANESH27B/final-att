
"use client"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Users, BookOpen, Percent } from "lucide-react";
import { ChartContainer, ChartTooltipContent } from "@/components/ui/chart";
import { BarChart, Bar, CartesianGrid, XAxis, YAxis, Tooltip, LineChart, Line } from "recharts";
import { Skeleton } from "@/components/ui/skeleton";
import { useUser, useFirestore, useMemoFirebase, useCollection } from "@/firebase";
import { collection, collectionGroup, query, where } from "firebase/firestore";
import { Class, AttendanceRecord } from "@/lib/types";
import { useMemo } from "react";
import { format, parseISO } from 'date-fns';

const chartConfig = {
  attendance: {
    label: "Attendance",
    color: "hsl(var(--accent))",
  },
};

export default function FacultyDashboardPage() {
    const { user } = useUser();
    const firestore = useFirestore();

    // 1. Fetch classes for the current faculty
    const myClassesQuery = useMemoFirebase(() => 
        firestore && user ? query(collection(firestore, 'classes'), where('facultyId', '==', user.uid)) : null,
        [firestore, user]
    );
    const { data: myClasses, isLoading: isLoadingClasses } = useCollection<Class>(myClassesQuery);

    // 2. Fetch all attendance records for this faculty member's classes using a collection group query
    const attendanceQuery = useMemoFirebase(() =>
        firestore && user ? query(collectionGroup(firestore, 'attendance'), where('facultyId', '==', user.uid)) : null,
        [firestore, user]
    );
    const { data: attendanceRecords, isLoading: isLoadingAttendance } = useCollection<AttendanceRecord>(attendanceQuery);

    const isLoading = isLoadingClasses || isLoadingAttendance;

    const stats = useMemo(() => {
        if (!myClasses || !attendanceRecords) {
            return {
                totalClasses: 0,
                avgAttendance: 0,
            };
        }
        const presentCount = attendanceRecords.filter(a => a.status === 'Present').length;
        const avgAttendance = attendanceRecords.length > 0 ? (presentCount / attendanceRecords.length) * 100 : 0;
        return {
            totalClasses: myClasses.length,
            avgAttendance,
        };
    }, [myClasses, attendanceRecords]);
    
    const myClassAttendanceData = useMemo(() => {
        if (!myClasses || !attendanceRecords || myClasses.length === 0) return [];
    
        const classAttendance = myClasses.map((cls, index) => {
            const relevantAttendance = attendanceRecords.filter(a => a.classId === cls.id);
            if (relevantAttendance.length === 0) {
                return { name: cls.name, attendance: 0, fill: `hsl(var(--chart-${(index % 5) + 1}))` };
            }
            const presentCount = relevantAttendance.filter(a => a.status === 'Present').length;
            const avg = (presentCount / relevantAttendance.length) * 100;
            return { name: cls.name, attendance: parseFloat(avg.toFixed(1)), fill: `hsl(var(--chart-${(index % 5) + 1}))` };
        });
        
        return classAttendance;
    
    }, [myClasses, attendanceRecords]);

    const myOverallAttendanceData = useMemo(() => {
        if (!attendanceRecords || attendanceRecords.length === 0) return [];

        const attendanceByMonth: { [key: string]: { present: number, total: number } } = {};

        attendanceRecords.forEach(record => {
            try {
                const month = format(parseISO(record.date), 'MMM');
                if (!attendanceByMonth[month]) {
                    attendanceByMonth[month] = { present: 0, total: 0 };
                }
                attendanceByMonth[month].total++;
                if (record.status === 'Present') {
                    attendanceByMonth[month].present++;
                }
            } catch (e) {
                // Ignore records with invalid date formats
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


  return (
    <div className="space-y-4">
       <h1 className="text-2xl font-bold tracking-tight font-headline">Faculty Dashboard</h1>
      <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-4">
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
            <CardTitle className="text-sm font-medium">Upcoming Class</CardTitle>
            <BookOpen className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
             {isLoading ? <Skeleton className="h-8 w-1/2" /> : <div className="text-2xl font-bold">{myClasses && myClasses.length > 0 ? myClasses[0].name : "N/A"}</div>}
            <p className="text-xs text-muted-foreground">Next on your schedule</p>
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
             myClassAttendanceData.length > 0 ? (
                <ChartContainer config={chartConfig} className="min-h-[250px] w-full">
                    <BarChart data={myClassAttendanceData} accessibilityLayer>
                       <CartesianGrid vertical={false} />
                       <XAxis dataKey="name" tickLine={false} tickMargin={10} axisLine={false} tickFormatter={(value) => value.slice(0, 6)} />
                       <YAxis domain={[0, 100]} unit="%" />
                       <Tooltip cursor={false} content={<ChartTooltipContent indicator="dot" />} />
                       <Bar dataKey="attendance" radius={8}>
                         {myClassAttendanceData.map((entry, index) => (
                           <Bar key={`bar-${index}`} dataKey="attendance" fill={entry.fill} />
                         ))}
                       </Bar>
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
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle>Overall Attendance Trend</CardTitle>
            <CardDescription>Your students' monthly attendance trend.</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? <Skeleton className="h-[250px] w-full" /> : (
            myOverallAttendanceData.length > 0 ? (
                <ChartContainer config={chartConfig} className="min-h-[250px] w-full">
                    <LineChart data={myOverallAttendanceData} accessibilityLayer margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                      <CartesianGrid vertical={false} />
                      <XAxis dataKey="date" tickLine={false} tickMargin={10} axisLine={false} />
                      <YAxis domain={[0, 100]} unit="%" />
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

    