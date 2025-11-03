// Using client directive for form interactivity and hooks
"use client";

import { useActionState, useEffect, useMemo, useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  generateAttendanceInsights,
  AttendanceInsightsOutput,
} from "@/ai/flows/attendance-analytics-insights";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Bot, FileText, ImageIcon, Lightbulb, Loader2 } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { useCollection, useFirestore, useMemoFirebase } from "@/firebase";
import { collection, collectionGroup, getDocs, query, where } from "firebase/firestore";
import { Class, User, AttendanceRecord } from "@/lib/types";

const formSchema = z.object({
  analysisType: z.enum(["class", "student", "faculty"]),
  targetId: z.string().min(1, "Please select an item."),
  reportFormat: z.enum(["PDF", "Excel"]),
  visualizationTypes: z.array(z.string()).refine((value) => value.some((item) => item), {
    message: "You have to select at least one visualization type.",
  }),
});

type FormValues = z.infer<typeof formSchema>;

const visualizationOptions = [
  { id: "bar", label: "Bar Chart" },
  { id: "pie", label: "Pie Chart" },
  { id: "line", label: "Line Graph" },
] as const;


export default function AnalyticsPage() {
  const { toast } = useToast();
  const firestore = useFirestore();

  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<AttendanceInsightsOutput | null>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      analysisType: "class",
      targetId: "",
      reportFormat: "PDF",
      visualizationTypes: ["bar", "line"],
    },
  });
  
  const classesQuery = useMemoFirebase(() => firestore ? collection(firestore, 'classes') : null, [firestore]);
  const usersQuery = useMemoFirebase(() => firestore ? collection(firestore, 'users') : null, [firestore]);

  const { data: classesData, isLoading: isLoadingClasses } = useCollection<Class>(classesQuery);
  const { data: usersData, isLoading: isLoadingUsers } = useCollection<User>(usersQuery);

  const { students, faculty } = useMemo(() => {
    const students = usersData?.filter(u => u.role === 'student') || [];
    const faculty = usersData?.filter(u => u.role === 'faculty') || [];
    return { students, faculty };
  }, [usersData]);


  const analysisType = form.watch("analysisType");
  

  const onSubmit = (values: FormValues) => {
    startTransition(async () => {
      try {
        setResult(null);
        if (!firestore) {
          throw new Error("Firestore is not initialized.");
        }

        let attendanceQuery;
        const analysisType = values.analysisType;
        const targetId = values.targetId;

        if (analysisType === 'class') {
          attendanceQuery = query(collection(firestore, `classes/${targetId}/attendance`));
        } else if (analysisType === 'student') {
          attendanceQuery = query(collectionGroup(firestore, 'attendance'), where('studentId', '==', targetId));
        } else if (analysisType === 'faculty') {
          // This is more complex, requires getting all classes for a faculty, then all attendance for those classes.
          const facultyClassesQuery = query(collection(firestore, 'classes'), where('facultyId', '==', targetId));
          const facultyClassesSnap = await getDocs(facultyClassesQuery);
          const classIds = facultyClassesSnap.docs.map(doc => doc.id);
          if (classIds.length > 0) {
            attendanceQuery = query(collectionGroup(firestore, 'attendance'), where('classId', 'in', classIds));
          } else {
            // No classes for this faculty, so no attendance data.
            toast({ title: "No Data", description: "This faculty member has no classes to analyze." });
            return;
          }
        }

        if (!attendanceQuery) {
            toast({ title: "No Data", description: "Could not form a query for attendance data." });
            return;
        }

        const attendanceSnap = await getDocs(attendanceQuery);
        const attendanceData = attendanceSnap.docs.map(doc => ({id: doc.id, ...doc.data()}));

        if(attendanceData.length === 0) {
            toast({ title: "No Data", description: "No attendance records found for the selected criteria." });
            return;
        }

        const insights = await generateAttendanceInsights({
          attendanceData: JSON.stringify(attendanceData),
          analysisPreferences: `Focus on ${values.analysisType} with ID ${values.targetId}`,
          reportFormat: values.reportFormat,
          visualizationTypes: values.visualizationTypes as ('bar' | 'pie' | 'line')[],
        });

        setResult(insights);
        toast({
          title: "Report Generated",
          description: "Your AI-powered insights are ready.",
        });
      } catch (e: any) {
        console.error(e);
        toast({
          variant: "destructive",
          title: "Generation Failed",
          description: e.message || "An unexpected error occurred.",
        });
      }
    });
  };

  const handleDownloadReport = () => {
    if (!result) return;
    
    const mimeType = result.reportFormat === 'PDF' ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    const fileExtension = result.reportFormat === 'PDF' ? '.pdf' : '.xlsx';
    
    try {
      const byteCharacters = atob(result.report);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], {type: mimeType});

      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `attendance_report_${new Date().toISOString().slice(0,10)}${fileExtension}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

    } catch (error) {
      console.error("Download failed:", error);
      toast({
        variant: "destructive",
        title: "Download Failed",
        description: "The report data could not be processed for download."
      });
    }
  };

  const isLoading = isLoadingClasses || isLoadingUsers;
  const currentSelectionData = analysisType === 'class' ? classesData : (analysisType === 'student' ? students : faculty);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Analytics & Reporting</CardTitle>
          <CardDescription>
            Generate class-wise, student-wise, or faculty-wise attendance reports and visualizations powered by AI.
          </CardDescription>
        </CardHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField
                  control={form.control}
                  name="analysisType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Analysis Type</FormLabel>
                      <Select onValueChange={(value) => {
                          field.onChange(value);
                          form.reset({
                              ...form.getValues(),
                              analysisType: value as 'class' | 'student' | 'faculty',
                              targetId: ""
                          });
                      }} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select analysis type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="class">Class-wise</SelectItem>
                          <SelectItem value="student">Student-wise</SelectItem>
                          <SelectItem value="faculty">Faculty-wise</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="targetId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Select {analysisType}</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value} disabled={isLoading}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder={isLoading ? `Loading...` : `Select a ${analysisType}...`} />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {currentSelectionData?.map(item => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField
                  control={form.control}
                  name="reportFormat"
                  render={({ field }) => (
                    <FormItem className="space-y-3">
                      <FormLabel>Report Format</FormLabel>
                      <FormControl>
                        <RadioGroup
                          onValueChange={field.onChange}
                          defaultValue={field.value}
                          className="flex items-center space-x-4"
                        >
                          <FormItem className="flex items-center space-x-2 space-y-0">
                            <FormControl>
                              <RadioGroupItem value="PDF" />
                            </FormControl>
                            <FormLabel className="font-normal">PDF</FormLabel>
                          </FormItem>
                          <FormItem className="flex items-center space-x-2 space-y-0">
                            <FormControl>
                              <RadioGroupItem value="Excel" />
                            </FormControl>
                            <FormLabel className="font-normal">Excel</FormLabel>
                          </FormItem>
                        </RadioGroup>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                 <FormField
                    control={form.control}
                    name="visualizationTypes"
                    render={() => (
                        <FormItem>
                        <div className="mb-3">
                            <FormLabel>Visualization Types</FormLabel>
                            <FormDescription>
                            Select the charts you want to include.
                            </FormDescription>
                        </div>
                        <div className="flex flex-col sm:flex-row sm:items-center sm:space-x-4 space-y-2 sm:space-y-0">
                        {visualizationOptions.map((item) => (
                            <FormField
                            key={item.id}
                            control={form.control}
                            name="visualizationTypes"
                            render={({ field }) => {
                                return (
                                <FormItem
                                    key={item.id}
                                    className="flex flex-row items-start space-x-2 space-y-0"
                                >
                                    <FormControl>
                                    <Checkbox
                                        value={item.id}
                                        checked={field.value?.includes(item.id)}
                                        onCheckedChange={(checked) => {
                                        const updatedValue = checked
                                            ? [...(field.value || []), item.id]
                                            : (field.value || []).filter(
                                                (value) => value !== item.id
                                              );
                                        field.onChange(updatedValue);
                                        }}
                                    />
                                    </FormControl>
                                    <FormLabel className="font-normal">
                                    {item.label}
                                    </FormLabel>
                                </FormItem>
                                )
                            }}
                            />
                        ))}
                        </div>
                        <FormMessage />
                    </FormItem>
                    )}
                    />
              </div>
            </CardContent>
            <CardFooter>
               <Button type="submit" disabled={isPending}>
                 {isPending ? <Loader2 className="animate-spin" /> : "Generate Report"}
               </Button>
            </CardFooter>
          </form>
        </Form>
      </Card>
      {isPending && (
          <Card>
              <CardContent className="p-6 flex justify-center items-center">
                  <Loader2 className="animate-spin h-8 w-8 text-primary" />
                  <p className="ml-4 text-muted-foreground">Generating your report...</p>
              </CardContent>
          </Card>
      )}
      {result && !isPending && (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2"><Bot /> Generated Insights</CardTitle>
                <CardDescription>AI-powered analysis of the selected data.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div>
                    <h3 className="font-semibold flex items-center gap-2"><FileText /> Report</h3>
                    <Button variant="link" className="p-0 h-auto text-sm" onClick={handleDownloadReport}>{`Download Report (${result.reportFormat})`}</Button>
                </div>
                <Separator/>
                <div>
                    <h3 className="font-semibold flex items-center gap-2"><ImageIcon /> Visualizations</h3>
                    <div className="text-sm text-muted-foreground flex flex-col space-y-1 mt-2">
                        {result.visualizations.map((vis, i) => <a href={vis} key={i} target="_blank" rel="noopener noreferrer" className="hover:underline">Visualization {i+1}</a>)}
                    </div>
                </div>
                <Separator/>
                <div>
                    <h3 className="font-semibold flex items-center gap-2"><Lightbulb /> Key Insights</h3>
                    <p className="text-sm text-muted-foreground mt-2 whitespace-pre-wrap font-code">{result.insights}</p>
                </div>
            </CardContent>
        </Card>
      )}
    </div>
  );
}
