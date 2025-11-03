
"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { QrCode, ScanLine, ListChecks, CheckCircle, PlayCircle, StopCircle, AlertTriangle, UserX, UserCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { useRef, useState, useEffect, useMemo, useCallback } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { useCollection, useFirestore, useUser, useMemoFirebase, errorEmitter, FirestorePermissionError } from "@/firebase";
import { collection, doc, query, setDoc, where, getDocs, serverTimestamp } from "firebase/firestore";
import { Class, User } from "@/lib/types";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format } from "date-fns";

export default function AttendancePage() {
  const { toast } = useToast();
  const firestore = useFirestore();
  const { user: currentUser } = useUser();
  
  const [sessionActive, setSessionActive] = useState(false);
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
  const [sessionDate, setSessionDate] = useState<string>("");
  const [manualRegNumber, setManualRegNumber] = useState("");

  const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null);
  const scannerRef = useRef<Html5Qrcode | null>(null);

  // Fetch classes for the current faculty member
  const facultyClassesQuery = useMemoFirebase(() =>
    firestore && currentUser ? query(collection(firestore, 'classes'), where('facultyId', '==', currentUser.uid)) : null,
    [firestore, currentUser]
  );
  const { data: facultyClasses, isLoading: isLoadingClasses } = useCollection<Class>(facultyClassesQuery);

  // Fetch students for the selected class
  const enrolledStudentsQuery = useMemoFirebase(() =>
    firestore && selectedClassId ? collection(firestore, 'classes', selectedClassId, 'students') : null,
    [firestore, selectedClassId]
  );
  const { data: enrolledStudents, isLoading: isLoadingEnrolled } = useCollection<User>(enrolledStudentsQuery);

  // Fetch today's attendance records for the selected class
  const attendanceQuery = useMemoFirebase(() =>
    firestore && selectedClassId && sessionDate ? query(collection(firestore, 'classes', selectedClassId, 'attendance'), where('date', '==', sessionDate)) : null,
    [firestore, selectedClassId, sessionDate]
  );
  const { data: attendanceRecords, isLoading: isLoadingAttendance } = useCollection(attendanceQuery);

  const presentStudentIds = useMemo(() => 
    new Set(attendanceRecords?.filter(r => r.status === 'Present').map(r => r.studentId) || [])
  , [attendanceRecords]);
  
  const studentMap = useMemo(() => 
    new Map(enrolledStudents?.map(s => [s.id, s]) || [])
  , [enrolledStudents]);

  const markAttendance = useCallback(async (studentIdentifier: string) => {
    if (!firestore || !selectedClassId || !sessionActive || !currentUser) return;

    // Find student by ID or registration number
    let student: User | undefined;
    if (studentMap.has(studentIdentifier)) {
      student = studentMap.get(studentIdentifier);
    } else {
      student = enrolledStudents?.find(s => s.registrationNumber === studentIdentifier);
    }

    if (!student) {
      toast({ variant: "destructive", title: "Student Not Found", description: "This student is not enrolled in the selected class." });
      return;
    }

    if (presentStudentIds.has(student.id)) {
        toast({ title: "Already Marked", description: `${student.name} is already marked as present.` });
        return;
    }

    const studentId = student.id;
    const attendanceDocRef = doc(firestore, `classes/${selectedClassId}/attendance`, `${sessionDate}_${studentId}`);
    const studentAttendanceDocRef = doc(firestore, `users/${studentId}/attendance`, `${selectedClassId}_${sessionDate}`);

    const attendanceData = {
      studentId,
      studentName: student.name,
      classId: selectedClassId,
      facultyId: currentUser.uid,
      date: sessionDate,
      status: "Present",
      timestamp: serverTimestamp(),
    };

    try {
      // Use a batch to write to both locations atomically
      const batch = setDoc(attendanceDocRef, attendanceData);
      await setDoc(studentAttendanceDocRef, attendanceData);

      toast({
        title: "Attendance Marked",
        description: `${student.name} has been marked as present.`,
        className: "bg-green-100 dark:bg-green-900 border-green-500",
      });
    } catch (error: any) {
        if (error.code === 'permission-denied') {
          const permissionError = new FirestorePermissionError({
            path: attendanceDocRef.path,
            operation: 'create',
            requestResourceData: attendanceData,
          });
          errorEmitter.emit('permission-error', permissionError);
        } else {
            toast({ variant: "destructive", title: "Error", description: "Could not mark attendance." });
            console.error("Error marking attendance: ", error);
        }
    }
  }, [firestore, selectedClassId, sessionActive, enrolledStudents, presentStudentIds, sessionDate, toast, currentUser, studentMap]);

  const handleStartSession = () => {
    if (!selectedClassId) {
      toast({ variant: "destructive", title: "Select a Class", description: "Please select a class before starting a session." });
      return;
    }
    setSessionDate(format(new Date(), "yyyy-MM-dd"));
    setSessionActive(true);
  };
  
  const handleEndSession = () => {
    setSessionActive(false);
  };

  useEffect(() => {
    const requestPermissionAndStart = async () => {
        if (sessionActive && selectedClassId) {
            try {
                await Html5Qrcode.getCameras();
                setHasCameraPermission(true);
            } catch (err) {
                setHasCameraPermission(false);
                toast({
                    variant: 'destructive',
                    title: 'Camera Permission Denied',
                    description: 'Please enable camera permissions to start scanning.',
                });
            }
        }
    }
    requestPermissionAndStart();
  }, [sessionActive, selectedClassId, toast]);

  useEffect(() => {
    if (sessionActive && hasCameraPermission) {
        const scanner = new Html5Qrcode('reader');
        scannerRef.current = scanner;
        scanner.start(
            { facingMode: "environment" },
            { fps: 10, qrbox: { width: 250, height: 250 } },
            (decodedText, decodedResult) => { markAttendance(decodedText); },
            (errorMessage) => { /* ignore */ }
        ).catch(err => {
            console.error("QR Scanner start failed:", err);
            if (err.name === "NotAllowedError") setHasCameraPermission(false);
        });
    }

    return () => {
        if (scannerRef.current?.isScanning) {
            scannerRef.current.stop().catch(err => console.error("Failed to stop scanner:", err));
        }
    };
  }, [sessionActive, hasCameraPermission, markAttendance]);
  
  const handleSubmitManual = () => {
    if (manualRegNumber) {
        markAttendance(manualRegNumber);
        setManualRegNumber("");
    }
  };
  
  const isLoading = isLoadingClasses || isLoadingEnrolled || isLoadingAttendance;
  const selectedClassName = facultyClasses?.find(c => c.id === selectedClassId)?.name || "";

  return (
    <div className="grid gap-4 grid-cols-1 lg:grid-cols-5">
      <div className="lg:col-span-3 space-y-4">
        <Card>
            <CardHeader>
                <CardTitle>Start Attendance Session</CardTitle>
                <CardDescription>Select a class and start taking attendance.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col sm:flex-row items-center gap-4">
                 <Select onValueChange={setSelectedClassId} disabled={sessionActive || isLoadingClasses}>
                    <SelectTrigger className="w-full sm:w-[280px]">
                        <SelectValue placeholder={isLoadingClasses ? "Loading classes..." : "Select a class"} />
                    </SelectTrigger>
                    <SelectContent>
                        {facultyClasses?.map(c => <SelectItem key={c.id} value={c.id}>{c.name} - {c.section}</SelectItem>)}
                    </SelectContent>
                </Select>
                <div className="flex gap-2">
                    <Button onClick={handleStartSession} disabled={sessionActive || !selectedClassId}><PlayCircle /> Start</Button>
                    <Button onClick={handleEndSession} disabled={!sessionActive} variant="destructive"><StopCircle/> End</Button>
                </div>
            </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><ScanLine /> QR Scanner</CardTitle>
            <CardDescription>Scan student QR codes to mark attendance.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="aspect-video bg-muted rounded-lg flex flex-col items-center justify-center relative overflow-hidden">
                <div id="reader" className="w-full h-full"></div>
                {!sessionActive && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-muted/80">
                        <QrCode className="h-16 w-16 text-muted-foreground" />
                        <p className="mt-4 text-muted-foreground">Session not active</p>
                    </div>
                )}
            </div>

            {sessionActive && hasCameraPermission === false && (
                <Alert variant="destructive" className="mt-4">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>Camera Access Denied</AlertTitle>
                    <AlertDescription>Please allow camera access in your browser settings to use this feature.</AlertDescription>
                </Alert>
            )}
            <div className="mt-4 flex flex-col sm:flex-row items-center gap-4">
              <Input 
                placeholder="Or enter registration number manually" 
                disabled={!sessionActive} 
                value={manualRegNumber}
                onChange={e => setManualRegNumber(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSubmitManual()}
              />
              <Button onClick={handleSubmitManual} disabled={!sessionActive || !manualRegNumber} className="w-full sm:w-auto">Submit</Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="lg:col-span-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><ListChecks /> Attendance Summary</CardTitle>
            <CardDescription>
              Live summary for <strong>{selectedClassName || "No Class Selected"}</strong>
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex justify-between items-center mb-4 p-4 bg-secondary rounded-lg">
                <div>
                    <p className="text-sm text-muted-foreground">Total</p>
                    <p className="text-2xl font-bold">{enrolledStudents?.length || 0}</p>
                </div>
                <Separator orientation="vertical" className="h-12" />
                 <div>
                    <p className="text-sm text-muted-foreground">Present</p>
                    <p className="text-2xl font-bold text-green-500">{presentStudentIds.size}</p>
                </div>
                 <Separator orientation="vertical" className="h-12" />
                 <div>
                    <p className="text-sm text-muted-foreground">Absent</p>
                    <p className="text-2xl font-bold text-red-500">{(enrolledStudents?.length || 0) - presentStudentIds.size}</p>
                </div>
            </div>
            
            <h3 className="font-semibold mb-2">Student List:</h3>
            <div className="space-y-2 max-h-80 overflow-y-auto pr-2">
              {isLoading && <p>Loading students...</p>}
              {!isLoading && enrolledStudents?.map((student) => {
                const isPresent = presentStudentIds.has(student.id);
                return (
                    <div key={student.id} className="flex items-center justify-between p-2 rounded-md border">
                        <span className="font-medium text-sm">{student.name}</span>
                        {isPresent ? (
                            <Badge variant="secondary" className="flex items-center gap-1 text-green-600">
                                <UserCheck className="h-3 w-3" />
                                Present
                            </Badge>
                        ) : (
                            <Badge variant="outline" className="flex items-center gap-1 text-red-600">
                                <UserX className="h-3 w-3" />
                                Absent
                            </Badge>
                        )}
                    </div>
                )
            })}
             {!isLoading && !enrolledStudents && <p className="text-muted-foreground text-center text-sm p-4">No class selected or no students enrolled.</p>}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

    