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
import { Line, LineChart, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import { mockStudentAttendance, overallAttendanceData } from "@/lib/data";
import { ChartContainer, ChartTooltipContent } from "@/components/ui/chart";

const chartConfig = {
  attendance: {
    label: "Attendance",
    color: "hsl(var(--accent))",
  },
}

export default function MyAttendancePage() {
  const overallPercentage = (mockStudentAttendance.reduce((acc, curr) => acc + curr.percentage, 0) / mockStudentAttendance.length).toFixed(1);

  return (
    <div className="space-y-4">
        <h1 className="text-2xl font-bold tracking-tight font-headline">My Attendance</h1>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Overall Attendance</CardDescription>
            <CardTitle className="text-4xl">{overallPercentage}%</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xs text-muted-foreground">
              You are on track. Keep it up!
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Classes Attended</CardDescription>
            <CardTitle className="text-4xl">{mockStudentAttendance.reduce((acc, curr) => acc + curr.attendedClasses, 0)}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xs text-muted-foreground">
                Out of {mockStudentAttendance.reduce((acc, curr) => acc + curr.totalClasses, 0)} total classes.
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Lowest Attendance</CardDescription>
            <CardTitle className="text-4xl">{Math.min(...mockStudentAttendance.map(s => s.percentage))}%</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xs text-muted-foreground">
                in {mockStudentAttendance.find(s => s.percentage === Math.min(...mockStudentAttendance.map(s => s.percentage)))?.subject}
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
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[180px]">Subject</TableHead>
                  <TableHead>Progress</TableHead>
                  <TableHead className="text-right">Percentage</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {mockStudentAttendance.map((subject) => (
                  <TableRow key={subject.subject}>
                    <TableCell className="font-medium">{subject.subject}</TableCell>
                    <TableCell>
                      <Progress value={subject.percentage} className="h-2" />
                    </TableCell>
                    <TableCell className="text-right">{subject.percentage.toFixed(1)}%</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Attendance Progress</CardTitle>
            <CardDescription>Your attendance trend over the last few months.</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="min-h-[200px] w-full">
                <LineChart data={overallAttendanceData} accessibilityLayer>
                  <CartesianGrid vertical={false} />
                  <XAxis dataKey="date" tickLine={false} tickMargin={10} axisLine={false} />
                  <YAxis domain={[70, 100]} />
                  <Tooltip cursor={false} content={<ChartTooltipContent />} />
                  <Line type="monotone" dataKey="attendance" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ fill: "hsl(var(--primary))" }} activeDot={{ r: 6 }} />
                </LineChart>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
