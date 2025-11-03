
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

const chartConfig = {
  attendance: {
    label: "Attendance",
    color: "hsl(var(--accent))",
  },
};

export default function FacultyDashboardPage() {
    const isLoading = false; // Using static data

    const stats = {
        totalClasses: 3,
        avgAttendance: 88.5,
        upcomingClass: "CS 101"
    };
    
    const myClassAttendanceData = [
        { name: 'CS 101', attendance: 92, fill: `hsl(var(--chart-1))` },
        { name: 'Math 203', attendance: 85, fill: `hsl(var(--chart-2))` },
        { name: 'Art 100', attendance: 95, fill: `hsl(var(--chart-3))` },
    ];

    const myOverallAttendanceData = [
      { date: 'Jan', attendance: 80 },
      { date: 'Feb', attendance: 82 },
      { date: 'Mar', attendance: 78 },
      { date: 'Apr', attendance: 85 },
      { date: 'May', attendance: 90 },
    ];


  return (
    <div className="space-y-4">
       <h1 className="text-2xl font-bold tracking-tight font-headline">Faculty Dashboard</h1>
      <div className="grid gap-4 grid-cols-1 md:grid-cols-3">
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
