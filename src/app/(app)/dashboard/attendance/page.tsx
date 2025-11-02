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
import { QrCode, ScanLine, ListChecks, CheckCircle, PlayCircle, StopCircle, AlertTriangle } from "lucide-react";
import { mockAttendanceRecords } from "@/lib/data";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { useRef, useState, useEffect } from "react";

export default function AttendancePage() {
  const [sessionActive, setSessionActive] = useState(false);
  const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    let stream: MediaStream | null = null;
    const getCameraPermission = async () => {
      try {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          throw new Error('Camera not supported by this browser.');
        }
        stream = await navigator.mediaDevices.getUserMedia({ video: true });
        setHasCameraPermission(true);

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch (error: any) {
        console.error('Error accessing camera:', error);
        setHasCameraPermission(false);
        // Don't automatically turn off the camera active state,
        // so the user can see the error message and retry.
        // setIsCameraActive(false); 

        if (error.name === "NotAllowedError" || error.name === "PermissionDeniedError") {
            toast({
              variant: 'destructive',
              title: 'Camera Access Denied',
              description: 'Please enable camera permissions in your browser settings.',
            });
        } else {
            toast({
              variant: 'destructive',
              title: 'Camera Error',
              description: error.message || 'Could not access the camera.',
            });
        }
      }
    };

    if (isCameraActive) {
      getCameraPermission();
    }

    return () => {
      // Cleanup function to stop video stream
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
    }
  }, [isCameraActive, toast]);


  const handleActivateCamera = () => {
    // When activating, reset permission state to show loading/feedback
    if (!isCameraActive) {
      setHasCameraPermission(null);
    }
    setIsCameraActive(prev => !prev);
  }

  return (
    <div className="grid gap-4 grid-cols-1 lg:grid-cols-5">
      <div className="lg:col-span-3 space-y-4">
        <Card>
            <CardHeader>
                <CardTitle>Start Attendance Session</CardTitle>
                <CardDescription>Select a class and start taking attendance.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col sm:flex-row gap-2">
                <Button onClick={() => setSessionActive(true)} disabled={sessionActive}><PlayCircle /> Start Session</Button>
                <Button onClick={() => setSessionActive(false)} disabled={!sessionActive} variant="destructive"><StopCircle/> End Session</Button>
            </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><ScanLine /> QR/Barcode Scanner</CardTitle>
            <CardDescription>
              Scan student QR codes to mark attendance. The system will provide audio feedback.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="aspect-video bg-muted rounded-lg flex flex-col items-center justify-center relative overflow-hidden">
                <video ref={videoRef} className="w-full h-full object-cover" autoPlay muted playsInline />
                {!isCameraActive && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-muted/80">
                        <QrCode className="h-16 w-16 text-muted-foreground" />
                        <p className="mt-4 text-muted-foreground">Camera is off</p>
                    </div>
                )}
            </div>
            <Button variant="secondary" className="w-full mt-4" onClick={handleActivateCamera}>
                {isCameraActive ? "Deactivate Camera" : "Activate Camera"}
            </Button>
            {isCameraActive && hasCameraPermission === false && (
                <Alert variant="destructive" className="mt-4">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>Camera Access Denied</AlertTitle>
                    <AlertDescription>
                        Please allow camera access in your browser settings to use this feature. You may need to refresh the page after granting permission.
                    </AlertDescription>
                </Alert>
            )}
            <div className="mt-4 flex flex-col sm:flex-row items-center gap-4">
              <Input placeholder="Or enter registration number manually" disabled={!sessionActive} />
              <Button disabled={!sessionActive} className="w-full sm:w-auto">Submit</Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="lg:col-span-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><ListChecks /> Attendance Summary</CardTitle>
            <CardDescription>
              Live summary for <strong>CS 101</strong>.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex justify-between items-center mb-4 p-4 bg-secondary rounded-lg">
                <div>
                    <p className="text-sm text-muted-foreground">Total</p>
                    <p className="text-2xl font-bold">35</p>
                </div>
                <Separator orientation="vertical" className="h-12" />
                 <div>
                    <p className="text-sm text-muted-foreground">Present</p>
                    <p className="text-2xl font-bold text-green-500">32</p>
                </div>
                 <Separator orientation="vertical" className="h-12" />
                 <div>
                    <p className="text-sm text-muted-foreground">Absent</p>
                    <p className="text-2xl font-bold text-red-500">3</p>
                </div>
            </div>
            
            <h3 className="font-semibold mb-2">Present Students:</h3>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {mockAttendanceRecords.filter(r => r.status === 'Present').map((record) => (
                <div key={record.id} className="flex items-center justify-between p-2 rounded-md border">
                  <span className="font-medium text-sm">{record.studentName}</span>
                  <Badge variant="secondary" className="flex items-center gap-1 text-green-600">
                    <CheckCircle className="h-3 w-3" />
                    Present
                  </Badge>
                </div>
              ))}
                <div className="flex items-center justify-between p-2 rounded-md border">
                  <span className="font-medium text-sm">Michael Scott</span>
                   <Badge variant="secondary" className="flex items-center gap-1 text-green-600">
                    <CheckCircle className="h-3 w-3" />
                    Present
                  </Badge>
                </div>
                <div className="flex items-center justify-between p-2 rounded-md border">
                  <span className="font-medium text-sm">Dwight Schrute</span>
                   <Badge variant="secondary" className="flex items-center gap-1 text-green-600">
                    <CheckCircle className="h-3 w-3" />
                    Present
                  </Badge>
                </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
