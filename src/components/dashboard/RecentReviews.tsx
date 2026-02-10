import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { GitMerge, Clock, CheckCircle2, AlertCircle, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface Review {
  id: string;
  title: string;
  repository: string;
  status: "passed" | "warnings" | "failed";
  issues: number;
  timestamp: string;
}

const mockReviews: Review[] = [
  {
    id: "1",
    title: "feat: Add user authentication",
    repository: "frontend-app",
    status: "passed",
    issues: 0,
    timestamp: "2 min ago",
  },
  {
    id: "2",
    title: "fix: Resolve memory leak in worker",
    repository: "backend-api",
    status: "warnings",
    issues: 3,
    timestamp: "15 min ago",
  },
  {
    id: "3",
    title: "refactor: Clean up utils module",
    repository: "shared-lib",
    status: "failed",
    issues: 8,
    timestamp: "1 hour ago",
  },
  {
    id: "4",
    title: "chore: Update dependencies",
    repository: "frontend-app",
    status: "passed",
    issues: 0,
    timestamp: "2 hours ago",
  },
];

const statusConfig = {
  passed: {
    icon: CheckCircle2,
    label: "Passed",
    className: "bg-success/10 text-success border-success/20",
  },
  warnings: {
    icon: AlertCircle,
    label: "Warnings",
    className: "bg-warning/10 text-warning border-warning/20",
  },
  failed: {
    icon: XCircle,
    label: "Failed",
    className: "bg-destructive/10 text-destructive border-destructive/20",
  },
};

export function RecentReviews() {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <GitMerge className="h-5 w-5 text-primary" />
          Recent Reviews
        </CardTitle>
        <Badge variant="secondary" className="font-mono text-xs">
          {mockReviews.length} total
        </Badge>
      </CardHeader>
      <CardContent className="space-y-3">
        {mockReviews.map((review) => {
          const config = statusConfig[review.status];
          const StatusIcon = config.icon;
          
          return (
            <div
              key={review.id}
              className="group flex items-center justify-between rounded-lg border border-border bg-secondary/30 p-4 transition-all duration-200 hover:bg-secondary/50 hover:border-primary/30"
            >
              <div className="flex items-center gap-4">
                <div className={cn(
                  "flex h-10 w-10 items-center justify-center rounded-lg",
                  review.status === "passed" && "bg-success/10",
                  review.status === "warnings" && "bg-warning/10",
                  review.status === "failed" && "bg-destructive/10"
                )}>
                  <StatusIcon className={cn(
                    "h-5 w-5",
                    review.status === "passed" && "text-success",
                    review.status === "warnings" && "text-warning",
                    review.status === "failed" && "text-destructive"
                  )} />
                </div>
                <div>
                  <p className="font-medium text-foreground group-hover:text-primary transition-colors">
                    {review.title}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs font-mono text-muted-foreground">
                      {review.repository}
                    </span>
                    <span className="text-muted-foreground">•</span>
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      {review.timestamp}
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {review.issues > 0 && (
                  <span className="text-sm text-muted-foreground">
                    {review.issues} issue{review.issues !== 1 ? "s" : ""}
                  </span>
                )}
                <Badge className={config.className}>
                  {config.label}
                </Badge>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
