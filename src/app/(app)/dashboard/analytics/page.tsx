// Using client directive for form interactivity and hooks
"use client";

import { useActionState, useEffect } from "react";
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
import { mockClasses, mockUsers } from "@/lib/data";
import { Bot, FileText, ImageIcon, Lightbulb, Loader2 } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { useFormStatus } from "react-dom";

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

type ActionState = {
  data: AttendanceInsightsOutput | null;
  errors?: z.ZodIssue[];
};

export default function AnalyticsPage() {
  const { toast } = useToast();
  const [state, formAction, isPending] = useActionState(handleGenerateReport, {
    data: null,
  });

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      analysisType: "class",
      targetId: "",
      reportFormat: "PDF",
      visualizationTypes: ["bar", "line"],
    },
  });

  const analysisType = form.watch("analysisType");
  
  useEffect(() => {
    if (state.errors) {
      toast({
        variant: "destructive",
        title: "Validation Error",
        description: "Please check the form for errors.",
      });
      state.errors.forEach((error) => {
        form.setError(error.path[0] as keyof FormValues, {
          message: error.message,
        });
      });
    }
  }, [state, form, toast]);

  async function handleGenerateReport(
    _prevState: ActionState,
    formData: FormData
  ): Promise<ActionState> {
    const data = Object.fromEntries(formData);
    const parsed = formSchema.safeParse({
      ...data,
      visualizationTypes: formData.getAll('visualizationTypes')
    });

    if (!parsed.success) {
        return { data: null, errors: parsed.error.issues };
    }

    try {
      const result = await generateAttendanceInsights({
        attendanceData: JSON.stringify({ message: "Dummy attendance data for " + parsed.data.targetId }),
        analysisPreferences: `Focus on ${parsed.data.analysisType}`,
        reportFormat: parsed.data.reportFormat,
        visualizationTypes: parsed.data.visualizationTypes as ('bar' | 'pie' | 'line')[],
      });
      return { data: result };
    } catch (e) {
      console.error(e);
      return { data: null };
    }
  }

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
          <form action={formAction}>
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
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder={`Select a ${analysisType}...`} />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {analysisType === 'class' && mockClasses.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                          {analysisType === 'student' && mockUsers.filter(u=>u.role==='student').map(u => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}
                          {analysisType === 'faculty' && mockUsers.filter(u=>u.role==='faculty').map(u => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}
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
                                        name={field.name}
                                        checked={field.value?.includes(item.id)}
                                        onCheckedChange={(checked) => {
                                        return checked
                                            ? field.onChange([...(field.value || []), item.id])
                                            : field.onChange(
                                                (field.value || [])?.filter(
                                                (value) => value !== item.id
                                                )
                                            )
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
              <SubmitButton isPending={isPending} />
            </CardFooter>
          </form>
        </Form>
      </Card>
      {state.data && (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2"><Bot /> Generated Insights</CardTitle>
                <CardDescription>AI-powered analysis of the selected data.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div>
                    <h3 className="font-semibold flex items-center gap-2"><FileText /> Report</h3>
                    <a href={state.data.report} className="text-sm text-primary hover:underline">{`Download Report (${state.data.report.split('.').pop()?.toUpperCase()})`}</a>
                </div>
                <Separator/>
                <div>
                    <h3 className="font-semibold flex items-center gap-2"><ImageIcon /> Visualizations</h3>
                    <div className="text-sm text-muted-foreground flex flex-col space-y-1 mt-2">
                        {state.data.visualizations.map((vis, i) => <span key={i}>- {vis}</span>)}
                    </div>
                </div>
                <Separator/>
                <div>
                    <h3 className="font-semibold flex items-center gap-2"><Lightbulb /> Key Insights</h3>
                    <p className="text-sm text-muted-foreground mt-2 whitespace-pre-wrap font-code">{state.data.insights}</p>
                </div>
            </CardContent>
        </Card>
      )}
    </div>
  );
}

function SubmitButton({isPending}: {isPending: boolean}) {
    const { pending } = useFormStatus();
    return (
        <Button type="submit" disabled={pending || isPending}>
            {(pending || isPending) ? <Loader2 className="animate-spin" /> : "Generate Report"}
        </Button>
    )
}
