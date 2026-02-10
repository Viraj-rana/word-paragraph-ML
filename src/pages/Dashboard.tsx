import { MainLayout } from "@/components/layout/MainLayout";
import { StatsCard } from "@/components/dashboard/StatsCard";
import { RecentReviews } from "@/components/dashboard/RecentReviews";
import { GitMerge, CheckCircle2, AlertTriangle, Clock } from "lucide-react";

export default function Dashboard() {
  return (
    <MainLayout>
      <div className="space-y-8 animate-fade-in">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="mt-2 text-muted-foreground">
            Monitor your automated code reviews and repository health.
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          <StatsCard
            title="Total Reviews"
            value={156}
            subtitle="This month"
            icon={GitMerge}
            trend={{ value: 12, positive: true }}
          />
          <StatsCard
            title="Passed"
            value={128}
            subtitle="82% success rate"
            icon={CheckCircle2}
            trend={{ value: 5, positive: true }}
          />
          <StatsCard
            title="Warnings"
            value={21}
            subtitle="Need attention"
            icon={AlertTriangle}
            trend={{ value: 3, positive: false }}
          />
          <StatsCard
            title="Avg. Review Time"
            value="1.2m"
            subtitle="Per merge request"
            icon={Clock}
            trend={{ value: 15, positive: true }}
          />
        </div>

        {/* Recent Reviews */}
        <RecentReviews />
      </div>
    </MainLayout>
  );
}
