import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { lazy, Suspense } from "react";
import Dashboard from "./pages/Dashboard";
import NotFound from "./pages/NotFound";

const RepositoryIndexer = lazy(() => import("./pages/RepositoryIndexer"));
const MergeReview = lazy(() => import("./pages/MergeReview"));
const DiffComparison = lazy(() => import("./pages/DiffComparison"));
const StyleGuide = lazy(() => import("./pages/StyleGuide"));
const Settings = lazy(() => import("./pages/Settings"));

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <LanguageProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <ErrorBoundary>
            <Suspense fallback={<div className="min-h-screen bg-background flex items-center justify-center text-foreground">Loading...</div>}>
              <Routes>
                <Route path="/" element={<Dashboard />} />
                <Route path="/indexer" element={<ErrorBoundary><RepositoryIndexer /></ErrorBoundary>} />
                <Route path="/review" element={<ErrorBoundary><MergeReview /></ErrorBoundary>} />
                <Route path="/diff-compare" element={<ErrorBoundary><DiffComparison /></ErrorBoundary>} />
                <Route path="/style-guide" element={<StyleGuide />} />
                <Route path="/settings" element={<Settings />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
          </ErrorBoundary>
        </BrowserRouter>
      </TooltipProvider>
    </LanguageProvider>
  </QueryClientProvider>
);

export default App;
