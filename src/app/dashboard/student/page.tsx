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
import { Badge } from "@/components/ui/badge";
import { BookOpen, Percent } from "lucide-react";
import { useCollection, useFirestore, useUser, useMemoFirebase } from "@/firebase";
import { collection, query, where, collectionGroup } from "firebase/firestore";
import { AttendanceRecord, Class } from "@/lib/types";
import { useMemo, useState, useEffect } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { format, parseISO } from "date-fns";

type CombinedAttendanceRecord = {
  id: string;
  date: string;
  className: string;
  status: "Present" | "Absent";
};

export default function StudentDashboardPage() {
  const firestore = useFirestore();
  const { user } = useUser();

  // 1. Get all classes the student is enrolled in
  const enrolledClassesQuery = useMemoFirebase(() =>
    firestore && user ? query(collection(firestore, 'classes'), where('studentIds', 'array-contains', user.uid)) : null,
    [firestore, user]
  );
  const { data: enrolledClasses, isLoading: isLoadingClasses } = useCollection<Class>(enrolledClassesQuery);

  // 2. Get all attendance records for those classes
  const classAttendanceQuery = useMemoFirebase(() => 
    firestore && enrolledClasses && enrolledClasses.length > 0
      ? query(collectionGroup(firestore, 'attendance'), where('classId', 'in', enrolledClasses.map(c => c.id)))
      : null,
    [firestore, enrolledClasses]
  );
  const { data: allClassAttendance, isLoading: isLoadingClassAttendance } = useCollection<AttendanceRecord>(classAttendanceQuery);

  // 3. Get the student's personal "Present" records
  const studentPresentRecordsQuery = useMemoFirebase(() =>
    firestore && user ? query(collection(firestore, `users/${user.uid}/attendance`), where('status', '==', 'Present')) : null,
    [firestore, user]
  );
  const { data: studentPresentRecords, isLoading: isLoadingStudentRecords } = useCollection<AttendanceRecord>(studentPresentRecordsQuery);
  
  const isLoading = isLoadingClasses || isLoadingClassAttendance || isLoadingStudentRecords;

  const { combinedAttendance, stats } = useMemo(() => {
    if (!enrolledClasses || !allClassAttendance || !studentPresentRecords) {
      return {
        combinedAttendance: [],
        stats: { totalClasses: 0, overallPercentage: 0 },
      };
    }

    const presentRecordKeys = new Set(studentPresentRecords.map(r => `${r.classId}-${r.date}`));
    
    // Create a map of all unique class sessions that have occurred
    const allSessions = new Map<string, Omit<CombinedAttendanceRecord, 'status'>>();
    allClassAttendance.forEach(record => {
      const sessionKey = `${record.classId}-${record.date}`;
      if (!allSessions.has(sessionKey)) {
        allSessions.set(sessionKey, {
          id: sessionKey,
          date: record.date,
          className: record.className || enrolledClasses.find(c => c.id === record.classId)?.name || "Unknown Class",
        });
      }
    });
    
    // Filter sessions to only include those relevant to the current student
    const studentSessions = Array.from(allSessions.values()).filter(session => {
        const studentIsEnrolled = allClassAttendance.some(att => att.classId === session.id.split('-')[0] && att.studentId === user?.uid);
        // A session is relevant if an attendance record (present or absent) exists for that student in that class
        const studentRecordExistsForClass = allClassAttendance.some(att => att.classId === session.id.split('-')[0] && att.studentId === user?.uid);
        
        // Let's refine the logic. A session is relevant if the student was enrolled in the class *when* attendance was taken.
        // The most reliable way is to see if *any* attendance record for the student exists in that class's log.
        // allClassAttendance contains all records for all students in the enrolled classes.
        // We need to find all unique sessions for the classes the student is in.
        return true; // For now, let's just use all sessions from their classes.
    });
    
    const uniqueStudentSessions = new Map<string, Omit<CombinedAttendanceRecord, 'status'>>();
    allClassAttendance.forEach(record => {
        if (record.studentId === user?.uid) {
            const sessionKey = `${record.classId}-${record.date}`;
            if (!uniqueStudentSessions.has(sessionKey)) {
                uniqueStudentSessions.set(sessionKey, {
                    id: sessionKey,
                    date: record.date,
                    className: record.className || enrolledClasses.find(c => c.id === record.classId)?.name || "Unknown Class",
                });
            }
        }
    });


    const finalAttendance: CombinedAttendanceRecord[] = Array.from(uniqueStudentSessions.values()).map(session => {
      const sessionKey = session.id;
      const isPresent = presentRecordKeys.has(sessionKey);
      return {
        ...session,
        status: isPresent ? "Present" : "Absent",
      };
    });
    
    const totalSessions = finalAttendance.length;
    const presentCount = finalAttendance.filter(r => r.status === 'Present').length;

    const newStats = {
      totalClasses: enrolledClasses.length,
      overallPercentage: totalSessions > 0 ? (presentCount / totalSessions) * 100 : 0,
    };
    
    const sortedAttendance = finalAttendance.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    
    return { combinedAttendance: sortedAttendance, stats: newStats };

  }, [enrolledClasses, allClassAttendance, studentPresentRecords, user]);


  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight font-headline">Student Dashboard</h1>

      <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Enrolled Classes</CardTitle>
            <BookOpen className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-1/4" />
            ) : (
              <div className="text-2xl font-bold">{stats.totalClasses}</div>
            )}
            <p className="text-xs text-muted-foreground">All your subjects this semester.</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Overall Attendance</CardTitle>
            <Percent className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-1/4" />
            ) : (
              <div className="text-2xl font-bold">{stats.overallPercentage.toFixed(1)}%</div>
            )}
            <p className="text-xs text-muted-foreground">Across all your classes.</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Daily Attendance Log</CardTitle>
          <CardDescription>Your day-to-day attendance record for all classes.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Class</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-40" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-16" /></TableCell>
                  </TableRow>
                ))
              ) : combinedAttendance.length > 0 ? (
                combinedAttendance.map((record) => (
                  <TableRow key={record.id}>
                    <TableCell>
                      {format(parseISO(record.date), "PPP")}
                    </TableCell>
                    <TableCell>{record.className}</TableCell>
                    <TableCell>
                      <Badge variant={record.status === "Present" ? "secondary" : "destructive"}>
                        {record.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={3} className="text-center text-muted-foreground">
                    No attendance records found.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
