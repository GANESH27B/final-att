

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
import { QrCode, ScanLine, ListChecks, StopCircle, AlertTriangle, UserX, UserCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { useRef, useState, useEffect, useMemo, useCallback } from "react";
import { Html5Qrcode, Html5QrcodeSupportedFormats } from "html5-qrcode";
import { useCollection, useFirestore, useUser, useMemoFirebase, errorEmitter, FirestorePermissionError } from "@/firebase";
import { collection, doc, query, setDoc, where, serverTimestamp, deleteDoc, writeBatch } from "firebase/firestore";
import { Class, User } from "@/lib/types";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { Switch } from "@/components/ui/switch";

const scannerConfig = {
  fps: 10,
  qrbox: (viewfinderWidth: number, viewfinderHeight: number) => {
    const minEdge = Math.min(viewfinderWidth, viewfinderHeight);
    const qrboxSize = Math.max(50, Math.min(250, minEdge * 0.7));
    return {
      width: qrboxSize,
      height: qrboxSize,
    };
  },
  supportedScanTypes: [
      Html5QrcodeSupportedFormats.QR_CODE,
      Html5QrcodeSupportedFormats.CODE_128,
      Html5QrcodeSupportedFormats.CODE_39,
      Html5QrcodeSupportedFormats.EAN_13,
      Html5QrcodeSupportedFormats.UPC_A,
  ]
};

type ScanResult = {
    status: "success" | "not_found" | "already_marked" | "error";
    message: string;
}

export default function AttendancePage() {
  const { toast } = useToast();
  const firestore = useFirestore();
  const { user: currentUser } = useUser();
  
  const [sessionActive, setSessionActive] = useState(false);
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
  const [sessionDate, setSessionDate] = useState<string>("");
  const [manualRegNumber, setManualRegNumber] = useState("");
  const [lastScanResult, setLastScanResult] = useState<ScanResult | null>(null);

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

  const handleClassSelection = (classId: string) => {
    setSelectedClassId(classId);
    setSessionDate(format(new Date(), "yyyy-MM-dd"));
    setSessionActive(true);
    setLastScanResult(null);
    toast({
        title: "Session Started",
        description: "You can now start taking attendance.",
    })
  };

  const setAttendanceStatus = useCallback(async (student: User, status: 'Present' | 'Absent') => {
    if (!firestore || !selectedClassId || !sessionDate || !currentUser) return;

    const studentId = student.id;
    const studentAttendanceDocRef = doc(firestore, `users/${studentId}/attendance`, `${sessionDate}_${selectedClassId}`);
    const classAttendanceDocRef = doc(firestore, `classes/${selectedClassId}/attendance`, `${sessionDate}_${studentId}`);
    
    const selectedClass = facultyClasses?.find(c => c.id === selectedClassId);
    const attendanceData = {
        studentId,
        studentName: student.name,
        classId: selectedClassId,
        className: selectedClass?.name || "Unknown Class",
        facultyId: currentUser.uid,
        date: sessionDate,
        status: "Present",
        timestamp: serverTimestamp(),
    };

    try {
        const batch = writeBatch(firestore);
        if (status === 'Absent') {
            batch.delete(classAttendanceDocRef);
            batch.delete(studentAttendanceDocRef);
            await batch.commit();
            toast({ title: "Marked Absent", description: `${student.name} marked as absent.` });
        } else {
            batch.set(classAttendanceDocRef, attendanceData);
            batch.set(studentAttendanceDocRef, attendanceData);
            await batch.commit();
            toast({ title: "Marked Present", description: `${student.name} marked as present.`, className: "bg-green-100 dark:bg-green-900 border-green-500"});
        }
    } catch (error: any) {
        if (error.code === 'permission-denied') {
          const permissionError = new FirestorePermissionError({ path: "batch write", operation: 'write', requestResourceData: { classId: selectedClassId } });
          errorEmitter.emit('permission-error', permissionError);
        } else {
            toast({ variant: "destructive", title: "Error", description: "Could not update attendance." });
        }
    }
  }, [firestore, selectedClassId, sessionDate, currentUser, toast, facultyClasses]);


  const markAttendance = useCallback(async (studentIdentifier: string) => {
    if (!firestore || !selectedClassId || !sessionActive || !currentUser) return;

    let student: User | undefined;
    // Student ID can come from QR code, or registration number from manual input
    const trimmedIdentifier = studentIdentifier.trim();
    if (studentMap.has(trimmedIdentifier)) {
      student = studentMap.get(trimmedIdentifier);
    } else {
      student = enrolledStudents?.find(s => s.registrationNumber === trimmedIdentifier);
    }

    if (!student) {
        setLastScanResult({ status: 'not_found', message: `Student with identifier "${trimmedIdentifier}" not found in this class.` });
        toast({ variant: "destructive", title: "Student Not Found", description: "This student is not enrolled in the selected class." });
        return;
    }

    if (presentStudentIds.has(student.id)) {
        setLastScanResult({ status: 'already_marked', message: `${student.name} is already marked as present.` });
        toast({ title: "Already Marked", description: `${student.name} is already marked as present.` });
        return;
    }
    
    await setAttendanceStatus(student, 'Present');
    setLastScanResult({ status: 'success', message: `${student.name} has been marked present.` });

  }, [firestore, selectedClassId, sessionActive, enrolledStudents, presentStudentIds, toast, currentUser, studentMap, setAttendanceStatus]);
  
  const handleEndSession = () => {
    setSessionActive(false);
    setSelectedClassId(null);
    setSessionDate("");
    setLastScanResult(null);
    setHasCameraPermission(null); // Reset camera permission state
    toast({
        title: "Session Ended",
        description: "You can select a new class to start another session.",
    })
  };
  
  useEffect(() => {
    let isComponentMounted = true;
    
    if (sessionActive) {
      const initializeScanner = async () => {
          try {
              await navigator.mediaDevices.getUserMedia({ video: true });
              if (isComponentMounted) setHasCameraPermission(true);
          } catch (err) {
              console.error('Camera permission error:', err);
              if (isComponentMounted) setHasCameraPermission(false);
              toast({
                  variant: 'destructive',
                  title: 'Camera Access Denied',
                  description: 'Please allow camera access in your browser settings to use this feature.',
              });
              return; // Stop if no permission
          }
        
          if (!isComponentMounted || scannerRef.current) return;
        
          const scanner = new Html5Qrcode('reader', {
              verbose: false,
              formatsToSupport: scannerConfig.supportedScanTypes,
          });
          scannerRef.current = scanner;

          scanner.start(
              { facingMode: 'environment' },
              scannerConfig,
              (decodedText) => {
                  markAttendance(decodedText);
                  if (scannerRef.current?.isScanning) {
                      try {
                          scannerRef.current.pause(true);
                          setTimeout(() => scannerRef.current?.resume(), 1500);
                      } catch (e) {
                          console.warn("Could not pause/resume scanner", e);
                      }
                  }
              },
              () => { /* ignore errors */ }
          ).catch((err) => {
              console.error('Scanner start error:', err);
              if (String(err).includes('NotAllowedError') || String(err).includes('NotFoundError')) {
                  if (isComponentMounted) setHasCameraPermission(false);
              }
          });
      };

      initializeScanner();
    }

    // Cleanup function
    return () => {
        isComponentMounted = false;
        if (scannerRef.current && scannerRef.current.isScanning) {
            scannerRef.current.clear().catch(error => {
                console.error("Failed to clear scanner state:", error);
            });
        }
    };
}, [sessionActive, markAttendance, toast]);
  
  const handleSubmitManual = () => {
    if (manualRegNumber) {
        markAttendance(manualRegNumber.trim());
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
                <CardTitle>Take Attendance</CardTitle>
                <CardDescription>Select a class to start an attendance session.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col sm:flex-row items-center gap-4">
                 <Select onValueChange={handleClassSelection} disabled={sessionActive || isLoadingClasses} value={selectedClassId || ""}>
                    <SelectTrigger className="w-full sm:w-[280px]">
                        <SelectValue placeholder={isLoadingClasses ? "Loading classes..." : "Select a class"} />
                    </SelectTrigger>
                    <SelectContent>
                        {facultyClasses?.map(c => <SelectItem key={c.id} value={c.id}>{c.name} - {c.section}</SelectItem>)}
                    </SelectContent>
                </Select>
                {sessionActive && (
                    <Button onClick={handleEndSession} variant="destructive" className="flex items-center gap-2">
                        <StopCircle />
                        End Session
                    </Button>
                )}
            </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><ScanLine /> QR/Barcode Scanner</CardTitle>
            <CardDescription>Scan student IDs or registration numbers to mark attendance.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="aspect-video bg-muted rounded-lg flex flex-col items-center justify-center relative overflow-hidden">
                <div id="reader" className="w-full h-full" />
                {!sessionActive && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-muted/80">
                        <QrCode className="h-16 w-16 text-muted-foreground" />
                        <p className="mt-4 text-muted-foreground">Select a class to start</p>
                    </div>
                )}
                 {sessionActive && hasCameraPermission === false && (
                    <Alert variant="destructive" className="absolute m-4">
                        <AlertTriangle className="h-4 w-4" />
                        <AlertTitle>Camera Access Denied</AlertTitle>
                        <AlertDescription>Please allow camera access in your browser settings to use this feature.</AlertDescription>
                    </Alert>
                )}
                 {sessionActive && hasCameraPermission === null && (
                    <Alert className="absolute m-4">
                        <AlertTriangle className="h-4 w-4" />
                        <AlertTitle>Requesting Camera</AlertTitle>
                        <AlertDescription>Please wait while we request camera access.</AlertDescription>
                    </Alert>
                )}
            </div>
             {sessionActive && lastScanResult && (
                <Alert className="mt-4" variant={lastScanResult.status === "success" ? "default" : "destructive"}>
                    <AlertTitle className="flex items-center gap-2">
                        {lastScanResult.status === "success" && <><UserCheck/>Scan Successful</>}
                        {lastScanResult.status === "not_found" && <><UserX/>Student Not Found</>}
                        {lastScanResult.status === "already_marked" && <><Badge>!</Badge>Already Marked</>}
                        {lastScanResult.status === "error" && <><AlertTriangle/>Scan Error</>}
                    </AlertTitle>
                    <AlertDescription>{lastScanResult.message}</AlertDescription>
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
            <div className="space-y-2 max-h-[420px] overflow-y-auto pr-2">
              {isLoading && <p className="text-muted-foreground text-center p-4">Loading students...</p>}
              {!isLoading && enrolledStudents?.map((student) => {
                const isPresent = presentStudentIds.has(student.id);
                return (
                    <div key={student.id} className="flex items-center justify-between p-2 rounded-md border">
                        <span className="font-medium text-sm">{student.name}</span>
                        <div className="flex items-center gap-2">
                          <span className={cn("text-xs", isPresent ? "text-green-600" : "text-red-600")}>{isPresent ? "Present" : "Absent"}</span>
                          <Switch
                            checked={isPresent}
                            onCheckedChange={(checked) => setAttendanceStatus(student, checked ? 'Present' : 'Absent')}
                            aria-label={`Mark ${student.name} as ${isPresent ? 'absent' : 'present'}`}
                          />
                        </div>
                    </div>
                )
            })}
             {!isLoading && (!enrolledStudents || enrolledStudents.length === 0) && <p className="text-muted-foreground text-center text-sm p-4">No class selected or no students enrolled.</p>}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
