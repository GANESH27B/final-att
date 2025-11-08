
"use client"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { BookOpen, Percent, User as UserIcon } from "lucide-react";
import { useCollection, useFirestore, useUser, useMemoFirebase, useDoc } from "@/firebase";
import { collection, collectionGroup, query, where, doc } from "firebase/firestore";
import { AttendanceRecord, User, Class } from "@/lib/types";
import { useMemo } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";

// A new component to render each class card
function ClassAttendanceCard({ classId }: { classId: string }) {
  const firestore = useFirestore();
  const { user } = useUser();

  const classRef = useMemoFirebase(() => firestore ? doc(firestore, 'classes', classId) : null, [firestore, classId]);
  const { data: classData, isLoading: isLoadingClass } = useDoc<Class>(classRef);

  const facultyRef = useMemoFirebase(() => firestore && classData?.facultyId ? doc(firestore, 'users', classData.facultyId) : null, [firestore, classData]);
  const { data: facultyData, isLoading: isLoadingFaculty } = useDoc<User>(facultyRef);

  // We query attendance scoped to the student and the specific class
  const attendanceQuery = useMemoFirebase(() => 
    firestore && user ? query(
      collection(firestore, `users/${user.uid}/attendance`), 
      where('classId', '==', classId)
    ) : null,
    [firestore, user, classId]
  );
  const { data: attendanceRecords, isLoading: isLoadingAttendance } = useCollection<AttendanceRecord>(attendanceQuery);

  const classAttendancePercentage = useMemo(() => {
    if (!attendanceRecords || attendanceRecords.length === 0) return 0;
    const presentCount = attendanceRecords.filter(r => r.status === 'Present').length;
    return (presentCount / attendanceRecords.length) * 100;
  }, [attendanceRecords]);
  
  const isLoading = isLoadingClass || isLoadingFaculty || isLoadingAttendance;

  if (isLoading) {
    return <ClassCardSkeleton />;
  }

  if (!classData) {
    return null; // Or some fallback UI if a class document is missing
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">{classData.name}</CardTitle>
        <CardDescription className="flex items-center gap-2">
            <UserIcon className="h-4 w-4" /> 
            {facultyData?.name || 'Loading faculty...'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
            <Progress value={classAttendancePercentage} className="h-2" />
            <div className="flex justify-between text-sm text-muted-foreground">
                <span>{classAttendancePercentage.toFixed(1)}% Attendance</span>
                <span>{attendanceRecords?.filter(r => r.status === 'Present').length || 0} / {attendanceRecords?.length || 0} classes</span>
            </div>
        </div>
      </CardContent>
    </Card>
  );
}

function ClassCardSkeleton() {
    return (
        <Card>
            <CardHeader>
                <Skeleton className="h-6 w-3/4" />
                <Skeleton className="h-4 w-1/2 mt-2" />
            </CardHeader>
            <CardContent>
                <Skeleton className="h-2 w-full" />
                <div className="flex justify-between mt-2">
                    <Skeleton className="h-4 w-1/4" />
                    <Skeleton className="h-4 w-1/4" />
                </div>
            </CardContent>
        </Card>
    )
}

export default function StudentDashboardPage() {
  const firestore = useFirestore();
  const { user } = useUser();

  // Query for all student attendance records
  const studentAttendanceQuery = useMemoFirebase(() => 
    firestore && user ? query(collection(firestore, `users/${user.uid}/attendance`)) : null,
    [firestore, user]
  );
  const { data: allAttendanceRecords, isLoading: isLoadingAttendance } = useCollection<AttendanceRecord>(studentAttendanceQuery);

  // Query for all class enrollments using the studentId field
  const enrolledClassesQuery = useMemoFirebase(() =>
    firestore && user ? query(collectionGroup(firestore, 'students'), where('studentId', '==', user.uid)) : null,
    [firestore, user]
  );
  const { data: enrolledClasses, isLoading: isLoadingEnrolled } = useCollection<User>(enrolledClassesQuery);

  
  const { avgAttendance } = useMemo(() => {
    if (!allAttendanceRecords) return { avgAttendance: 0 };
    
    const presentCount = allAttendanceRecords.filter(r => r.status === 'Present').length;
    const average = allAttendanceRecords.length > 0 ? (presentCount / allAttendanceRecords.length) * 100 : 0;

    return { avgAttendance: average };
  }, [allAttendanceRecords]);

  const totalEnrolledClasses = useMemo(() => {
    return enrolledClasses?.length || 0;
  }, [enrolledClasses]);

  const isLoading = isLoadingAttendance || isLoadingEnrolled;
  const classIds = useMemo(() => enrolledClasses?.map(c => c.classId).filter((id): id is string => !!id) || [], [enrolledClasses]);

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
            {isLoading ? <Skeleton className="h-8 w-1/2" /> : <div className="text-2xl font-bold">{totalEnrolledClasses}</div>}
            <p className="text-xs text-muted-foreground">
              All your subjects this semester.
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg. Attendance</CardTitle>
            <Percent className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? <Skeleton className="h-8 w-1/2" /> : <div className="text-2xl font-bold">{avgAttendance.toFixed(1)}%</div>}
            <p className="text-xs text-muted-foreground">
              Across all your classes.
            </p>
          </CardContent>
        </Card>
      </div>

        <div>
            <h2 className="text-xl font-bold tracking-tight font-headline mb-4">My Classes</h2>
            {isLoading ? (
                 <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
                    <ClassCardSkeleton />
                    <ClassCardSkeleton />
                </div>
            ) : (
                classIds.length > 0 ? (
                    <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
                       {classIds.map(classId => <ClassAttendanceCard key={classId} classId={classId} />)}
                    </div>
                ) : (
                    <Card className="flex flex-col items-center justify-center p-8 text-center">
                        <CardTitle>No Classes Found</CardTitle>
                        <CardDescription className="mt-2">You are not enrolled in any classes yet.</CardDescription>
                    </Card>
                )
            )}
        </div>
    </div>
  );
}
