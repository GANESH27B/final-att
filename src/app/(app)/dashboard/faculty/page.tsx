
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
import { useCollection, useFirestore, useUser, useMemoFirebase } from "@/firebase";
import { collection, query, where, getDocs, collectionGroup } from "firebase/firestore";
import { Class, User as UserType, AttendanceRecord } from "@/lib/types";
import { useMemo, useState, useEffect } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { format, parseISO } from 'date-fns';

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

    const attendanceQuery = useMemoFirebase(() => {
        if (!firestore || !user?.uid) return null;
        return query(collectionGroup(firestore, 'attendance'), where('facultyId', '==', user.uid));
    }, [firestore, user?.uid]);

    const { data: attendance, isLoading: isLoadingAttendance } = useCollection<AttendanceRecord>(attendanceQuery);
    
    const [studentCount, setStudentCount] = useState(0);
    const [isLoadingStudentCount, setIsLoadingStudentCount] = useState(true);

    useEffect(() => {
        const fetchStudentCount = async () => {
            if (!firestore || !myClasses) {
                 if (!isLoadingClasses) {
                    // If classes are done loading and there are none, count is 0.
                    setStudentCount(0);
                    setIsLoadingStudentCount(false);
                }
                return;
            };
            
            setIsLoadingStudentCount(true);
            if (myClasses.length === 0) {
                setStudentCount(0);
                setIsLoadingStudentCount(false);
                return;
            }

            try {
                let totalStudents = new Set<string>();
                const studentCountPromises = myClasses.map(cls => 
                    getDocs(collection(firestore, `classes/${cls.id}/students`))
                );
                const allStudentSnaps = await Promise.all(studentCountPromises);
                allStudentSnaps.forEach(studentsSnap => {
                    studentsSnap.forEach(doc => totalStudents.add(doc.id));
                });
                setStudentCount(totalStudents.size);
            } catch (error) {
                console.error("Error fetching student count:", error);
                setStudentCount(0);
            } finally {
                setIsLoadingStudentCount(false);
            }
        };

        // Only run fetchStudentCount if myClasses is defined (i.e., not null)
        if (myClasses !== null) {
            fetchStudentCount();
        }
    }, [firestore, myClasses, isLoadingClasses]);


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

        const presentCount = attendance?.filter(a => a.status === 'Present').length || 0;
        const avgAttendance = attendance && attendance.length > 0 ? (presentCount / attendance.length) * 100 : 0;
        
        // This is mock data, should be replaced with real scheduling logic
        const upcomingClass = myClasses.length > 0 ? myClasses[0].name : "None";

        return {
            totalStudents: studentCount,
            totalClasses,
            avgAttendance,
            upcomingClass
        };
    }, [myClasses, attendance, studentCount]);
    
    const myClassAttendanceData = useMemo(() => {
        if (!myClasses || myClasses.length === 0 || !attendance) return [];
    
        return myClasses.map((cls, index) => {
            const relevantAttendance = attendance.filter(a => a.classId === cls.id);
            if (relevantAttendance.length === 0) {
                return { name: cls.name, attendance: 0, fill: `hsl(var(--chart-${(index % 5) + 1}))` };
            }
            const presentCount = relevantAttendance.filter(a => a.status === 'Present').length;
            const avg = (presentCount / relevantAttendance.length) * 100;
            const fill = `hsl(var(--chart-${(index % 5) + 1}))`;

            // Dynamically update chart config for tooltips
            const key = cls.name.replace(/\s+/g, '').toLowerCase();
            if (!(chartConfig as any)[key]) {
                (chartConfig as any)[key] = { label: cls.name, color: fill };
            }

            return { name: cls.name, attendance: parseFloat(avg.toFixed(1)), fill };
        });
    
    }, [myClasses, attendance]);

    const myOverallAttendanceData = useMemo(() => {
        if (!attendance || attendance.length === 0) return [];

        const attendanceByMonth: { [key: string]: { present: number, total: number } } = {};

        attendance.forEach(record => {
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
                console.warn(`Invalid date format for record ${record.id}: ${record.date}`);
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
            <CardTitle className="text-sm font-medium">Upcoming Class</CardTitle>
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
             myClassAttendanceData.length > 0 ? (
                <ChartContainer config={chartConfig} className="min-h-[250px] w-full">
                    <BarChart data={myClassAttendanceData} accessibilityLayer>
                       <CartesianGrid vertical={false} />
                       <XAxis dataKey="name" tickLine={false} tickMargin={10} axisLine={false} tickFormatter={(value) => value.slice(0, 6)} />
                       <YAxis domain={[0, 100]} unit="%" />
                       <Tooltip cursor={false} content={<ChartTooltipContent indicator="dot" />} />
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

    