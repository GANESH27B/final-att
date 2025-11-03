'use client';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useDoc, useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { doc, collection } from 'firebase/firestore';
import { useParams } from 'next/navigation';
import { Class, User as UserType } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, User as UserIcon } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function ManageClassPage() {
  const firestore = useFirestore();
  const params = useParams();
  const classId = params.classId as string;

  const classDocRef = useMemoFirebase(
    () => (firestore && classId ? doc(firestore, `classes/${classId}`) : null),
    [firestore, classId]
  );
  const { data: classData, isLoading: isLoadingClass } = useDoc<Class>(classDocRef);
  
  const facultyDocRef = useMemoFirebase(
    () => (firestore && classData?.facultyId ? doc(firestore, `users/${classData.facultyId}`) : null),
    [firestore, classData?.facultyId]
  );
  const { data: facultyData, isLoading: isLoadingFaculty } = useDoc<UserType>(facultyDocRef);

  const studentsCollectionRef = useMemoFirebase(
    () => (firestore && classId ? collection(firestore, `classes/${classId}/students`) : null),
    [firestore, classId]
  );
  const { data: students, isLoading: isLoadingStudents } = useCollection<UserType>(studentsCollectionRef);
  
  const isLoading = isLoadingClass || isLoadingFaculty || isLoadingStudents;

  return (
    <div className="space-y-4">
       <div className="flex items-center gap-4">
        <Link href="/dashboard/classes" passHref>
          <Button variant="outline" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <h1 className="text-2xl font-bold tracking-tight font-headline">
          Manage Class
        </h1>
      </div>
      <div className="grid gap-4 grid-cols-1 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Enrolled Students</CardTitle>
              <CardDescription>
                View and manage students in this class.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-2">
                    <Skeleton className="h-12 w-full" />
                    <Skeleton className="h-12 w-full" />
                    <Skeleton className="h-12 w-full" />
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Registration No.</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {students && students.map((student) => (
                      <TableRow key={student.id}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <Avatar>
                              <AvatarImage src={student.avatarUrl} alt={student.name} />
                              <AvatarFallback>{student.name.substring(0,2)}</AvatarFallback>
                            </Avatar>
                            <div>
                                <p className="font-medium">{student.name}</p>
                                <p className="text-sm text-muted-foreground">{student.email}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>{student.registrationNumber || 'N/A'}</TableCell>
                        <TableCell>
                          <Badge variant={student.status === 'Active' ? 'secondary' : 'destructive'}>
                            {student.status}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
                {(!isLoading && students?.length === 0) && (
                    <div className="text-center text-muted-foreground p-8">
                        No students enrolled in this class yet.
                    </div>
                )}
            </CardContent>
          </Card>
        </div>
        <div className="lg:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle>Class Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                {isLoadingClass ? <Skeleton className="h-6 w-3/4" /> : <h2 className="text-xl font-semibold">{classData?.name}</h2>}
                <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                        <span className="text-muted-foreground">Section:</span>
                        {isLoadingClass ? <Skeleton className="h-4 w-10" /> : <span className="font-medium">{classData?.section}</span>}
                    </div>
                     <div className="flex justify-between">
                        <span className="text-muted-foreground">Students:</span>
                        {isLoadingStudents ? <Skeleton className="h-4 w-10" /> : <span className="font-medium">{students?.length || 0}</span>}
                    </div>
                    <div className="flex items-center justify-between pt-2">
                         <span className="text-muted-foreground flex items-center gap-2"><UserIcon className="h-4 w-4" /> Faculty:</span>
                         {isLoadingFaculty ? <Skeleton className="h-4 w-24" /> : <span className="font-medium">{facultyData?.name}</span>}
                    </div>
                </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
