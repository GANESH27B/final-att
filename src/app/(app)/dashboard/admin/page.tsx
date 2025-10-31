"use client"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { BarChart, LineChart } from "recharts";
import { Users, BookOpen, Percent, TrendingUp, TrendingDown } from "lucide-react";
import { classAttendanceData, overallAttendanceData } from "@/lib/data";
import { ChartContainer, ChartTooltipContent } from "@/components/ui/chart";
import { Bar, CartesianGrid, XAxis, YAxis, Tooltip, Line } from "recharts";


const chartConfig = {
  attendance: {
    label: "Attendance",
    color: "hsl(var(--accent))",
  },
  cs101: { label: "CS 101", color: "hsl(var(--chart-1))" },
  math203: { label: "Math 203", color: "hsl(var(--chart-2))" },
  art100: { label: "Art 100", color: "hsl(var(--chart-3))" },
  phys301: { label: "Phys 301", color: "hsl(var(--chart-4))" },
  eng210: { label: "Eng 210", color: "hsl(var(--chart-5))" },
}

export default function AdminDashboardPage() {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Students</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">1,254</div>
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <TrendingUp className="h-3 w-3 text-green-500" /> +20.1% from last month
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Faculty</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">42</div>
            <p className="text-xs text-muted-foreground">+5 from last year</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Classes</CardTitle>
            <BookOpen className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">112</div>
            <p className="text-xs text-muted-foreground">+10 since last semester</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg. Attendance</CardTitle>
            <Percent className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">89.5%</div>
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <TrendingDown className="h-3 w-3 text-red-500" /> -1.2% from last week
            </p>
          </CardContent>
        </Card>
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <Card className="lg:col-span-4">
          <CardHeader>
            <CardTitle>Class Attendance Overview</CardTitle>
            <CardDescription>
              Average attendance percentage for top classes this week.
            </CardDescription>
          </CardHeader>
          <CardContent>
             <ChartContainer config={chartConfig} className="min-h-[200px] w-full">
                <BarChart data={classAttendanceData} accessibilityLayer>
                   <CartesianGrid vertical={false} />
                   <XAxis dataKey="name" tickLine={false} tickMargin={10} axisLine={false} />
                   <YAxis />
                   <Tooltip cursor={false} content={<ChartTooltipContent />} />
                   <Bar dataKey="attendance" radius={8} />
                </BarChart>
             </ChartContainer>
          </CardContent>
        </Card>
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle>Overall Attendance Trend</CardTitle>
            <CardDescription>Monthly attendance trend for the current year.</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="min-h-[200px] w-full">
                <LineChart data={overallAttendanceData} accessibilityLayer>
                  <CartesianGrid vertical={false} />
                  <XAxis dataKey="date" tickLine={false} tickMargin={10} axisLine={false} />
                  <YAxis />
                  <Tooltip cursor={false} content={<ChartTooltipContent />} />
                  <Line type="monotone" dataKey="attendance" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
                </LineChart>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
