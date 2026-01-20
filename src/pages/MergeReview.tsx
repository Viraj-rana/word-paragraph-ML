import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  GitMerge, 
  Loader2, 
  AlertTriangle, 
  CheckCircle2, 
  XCircle,
  FileCode,
  MessageSquare,
  Clock,
  User
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";

interface ReviewIssue {
  id: string;
  file: string;
  line: number;
  severity: "error" | "warning" | "info";
  message: string;
  rule: string;
  suggestion?: string;
}

interface ReviewResult {
  mrTitle: string;
  author: string;
  filesChanged: number;
  linesAdded: number;
  linesRemoved: number;
  reviewTime: string;
  status: "passed" | "warnings" | "failed";
  issues: ReviewIssue[];
  summary: string;
}

const severityConfig = {
  error: {
    icon: XCircle,
    className: "text-destructive bg-destructive/10 border-destructive/20",
    label: "Error",
  },
  warning: {
    icon: AlertTriangle,
    className: "text-warning bg-warning/10 border-warning/20",
    label: "Warning",
  },
  info: {
    icon: MessageSquare,
    className: "text-primary bg-primary/10 border-primary/20",
    label: "Info",
  },
};

export default function MergeReview() {
  const { t } = useLanguage();
  const [mrUrl, setMrUrl] = useState("");
  const [accessToken, setAccessToken] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [result, setResult] = useState<ReviewResult | null>(null);
  const { toast } = useToast();

  const sendEmailNotification = async (reviewData: ReviewResult) => {
    setIsSendingEmail(true);
    try {
      const { error } = await supabase.functions.invoke("send-review-email", {
        body: {
          recipientEmail: "hackteck404@gmail.com",
          mrTitle: reviewData.mrTitle,
          mrUrl: mrUrl,
          author: reviewData.author,
          filesChanged: reviewData.filesChanged,
          linesAdded: reviewData.linesAdded,
          linesRemoved: reviewData.linesRemoved,
          reviewTime: reviewData.reviewTime,
          status: reviewData.status,
          issues: reviewData.issues,
          summary: reviewData.summary,
        },
      });

      if (error) {
        throw new Error(error.message || "Failed to send email notification");
      }

      toast({
        title: t("review.emailSent"),
        description: t("review.emailSentDesc"),
      });
    } catch (error) {
      console.error("Error sending email:", error);
      toast({
        title: t("review.emailFailed"),
        description: error instanceof Error ? error.message : "An unexpected error occurred",
        variant: "destructive",
      });
    } finally {
      setIsSendingEmail(false);
    }
  };

  const handleReview = async () => {
    if (!mrUrl) {
      toast({
        title: t("review.mrUrlRequired"),
        description: t("review.mrUrlRequiredDesc"),
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    setResult(null);
    
    try {
      const { data, error } = await supabase.functions.invoke("review-merge-request", {
        body: { mrUrl, accessToken: accessToken || undefined },
      });

      if (error) {
        throw new Error(error.message || "Failed to review merge request");
      }

      if (data.error) {
        throw new Error(data.error);
      }

      setResult(data);
      toast({
        title: t("review.reviewComplete"),
        description: t("review.reviewCompleteDesc").replace("{count}", String(data.issues?.length || 0)),
      });

      // Automatically send email notification after review completes
      await sendEmailNotification(data);
    } catch (error) {
      console.error("Error reviewing merge request:", error);
      toast({
        title: t("review.reviewFailed"),
        description: error instanceof Error ? error.message : "An unexpected error occurred",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <MainLayout>
      <div className="space-y-8 animate-fade-in">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t("review.title")}</h1>
          <p className="mt-2 text-muted-foreground">
            {t("review.description")}
          </p>
        </div>

        {/* Input Form */}
        <Card glow>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <GitMerge className="h-5 w-5 text-primary" />
              {t("review.config")}
            </CardTitle>
            <CardDescription>
              {t("review.configDesc")}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="mr-url">{t("review.mrUrl")}</Label>
                <Input
                  id="mr-url"
                  placeholder={t("review.mrUrlPlaceholder")}
                  value={mrUrl}
                  onChange={(e) => setMrUrl(e.target.value)}
                  className="font-mono text-sm"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="mr-token">
                  {t("review.accessToken")} <span className="text-muted-foreground">{t("review.forPrivateRepos")}</span>
                </Label>
                <Input
                  id="mr-token"
                  type="password"
                  placeholder={t("review.tokenPlaceholder")}
                  value={accessToken}
                  onChange={(e) => setAccessToken(e.target.value)}
                  className="font-mono text-sm"
                />
              </div>
            </div>
            <Button
              onClick={handleReview}
              disabled={isLoading}
              className="w-full md:w-auto"
              variant="glow"
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {t("review.analyzing")}
                </>
              ) : (
                <>
                  <GitMerge className="h-4 w-4" />
                  {t("review.startReview")}
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Results */}
        {result && (
          <div className="space-y-6 animate-slide-up">
            {/* Summary Card */}
            <Card>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-xl">{result.mrTitle}</CardTitle>
                    <CardDescription className="flex items-center gap-4 mt-2">
                      <span className="flex items-center gap-1">
                        <User className="h-4 w-4" />
                        {result.author}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="h-4 w-4" />
                        {result.reviewTime}
                      </span>
                    </CardDescription>
                  </div>
                  <Badge
                    className={cn(
                      result.status === "passed" && "bg-success/10 text-success border-success/20",
                      result.status === "warnings" && "bg-warning/10 text-warning border-warning/20",
                      result.status === "failed" && "bg-destructive/10 text-destructive border-destructive/20"
                    )}
                  >
                    {result.status === "passed" && <CheckCircle2 className="h-3 w-3 mr-1" />}
                    {result.status === "warnings" && <AlertTriangle className="h-3 w-3 mr-1" />}
                    {result.status === "failed" && <XCircle className="h-3 w-3 mr-1" />}
                    {result.status === "passed" ? t("review.passed") : result.status === "failed" ? t("review.failed") : result.status.charAt(0).toUpperCase() + result.status.slice(1)}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-4 mb-4">
                  <div className="text-center p-3 rounded-lg bg-secondary/50">
                    <p className="text-2xl font-bold">{result.filesChanged}</p>
                    <p className="text-xs text-muted-foreground">{t("review.filesChanged")}</p>
                  </div>
                  <div className="text-center p-3 rounded-lg bg-success/10">
                    <p className="text-2xl font-bold text-success">+{result.linesAdded}</p>
                    <p className="text-xs text-muted-foreground">{t("review.linesAdded")}</p>
                  </div>
                  <div className="text-center p-3 rounded-lg bg-destructive/10">
                    <p className="text-2xl font-bold text-destructive">-{result.linesRemoved}</p>
                    <p className="text-xs text-muted-foreground">{t("review.linesRemoved")}</p>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground">{result.summary}</p>
              </CardContent>
            </Card>

            {/* Issues */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileCode className="h-5 w-5 text-primary" />
                  {t("review.issuesFound")}
                  <Badge variant="secondary">{result.issues.length}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Tabs defaultValue="all" className="w-full">
                  <TabsList className="mb-4">
                    <TabsTrigger value="all">{t("review.all")} ({result.issues.length})</TabsTrigger>
                    <TabsTrigger value="errors">
                      {t("review.errors")} ({result.issues.filter(i => i.severity === "error").length})
                    </TabsTrigger>
                    <TabsTrigger value="warnings">
                      {t("review.warnings")} ({result.issues.filter(i => i.severity === "warning").length})
                    </TabsTrigger>
                  </TabsList>
                  
                  <TabsContent value="all" className="space-y-3">
                    {result.issues.map((issue) => {
                      const config = severityConfig[issue.severity];
                      const SeverityIcon = config.icon;
                      
                      return (
                        <div
                          key={issue.id}
                          className="rounded-lg border border-border bg-secondary/30 p-4"
                        >
                          <div className="flex items-start gap-3">
                            <div className={cn(
                              "flex h-8 w-8 items-center justify-center rounded-lg shrink-0",
                              issue.severity === "error" && "bg-destructive/10",
                              issue.severity === "warning" && "bg-warning/10",
                              issue.severity === "info" && "bg-primary/10"
                            )}>
                              <SeverityIcon className={cn(
                                "h-4 w-4",
                                issue.severity === "error" && "text-destructive",
                                issue.severity === "warning" && "text-warning",
                                issue.severity === "info" && "text-primary"
                              )} />
                            </div>
                            <div className="flex-1 space-y-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-mono text-sm text-primary">
                                  {issue.file}:{issue.line}
                                </span>
                                <Badge variant="outline" className="text-xs">
                                  {issue.rule}
                                </Badge>
                              </div>
                              <p className="text-sm">{issue.message}</p>
                              {issue.suggestion && (
                                <p className="text-xs text-muted-foreground mt-2 p-2 rounded bg-secondary/50">
                                  💡 {issue.suggestion}
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </TabsContent>
                  
                  <TabsContent value="errors" className="space-y-3">
                    {result.issues.filter(i => i.severity === "error").map((issue) => (
                      <div
                        key={issue.id}
                        className="rounded-lg border border-destructive/20 bg-destructive/5 p-4"
                      >
                        <div className="flex items-start gap-3">
                          <XCircle className="h-5 w-5 text-destructive shrink-0" />
                          <div className="space-y-1">
                            <span className="font-mono text-sm text-primary">
                              {issue.file}:{issue.line}
                            </span>
                            <p className="text-sm">{issue.message}</p>
                            {issue.suggestion && (
                              <p className="text-xs text-muted-foreground mt-2">
                                💡 {issue.suggestion}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </TabsContent>
                  
                  <TabsContent value="warnings" className="space-y-3">
                    {result.issues.filter(i => i.severity === "warning").map((issue) => (
                      <div
                        key={issue.id}
                        className="rounded-lg border border-warning/20 bg-warning/5 p-4"
                      >
                        <div className="flex items-start gap-3">
                          <AlertTriangle className="h-5 w-5 text-warning shrink-0" />
                          <div className="space-y-1">
                            <span className="font-mono text-sm text-primary">
                              {issue.file}:{issue.line}
                            </span>
                            <p className="text-sm">{issue.message}</p>
                            {issue.suggestion && (
                              <p className="text-xs text-muted-foreground mt-2">
                                💡 {issue.suggestion}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </MainLayout>
  );
}