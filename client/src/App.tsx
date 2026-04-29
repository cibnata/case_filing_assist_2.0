import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import CaseList from "./pages/CaseList";
import CaseCreate from "./pages/CaseCreate";
import CaseDetail from "./pages/CaseDetail";
import ReportPage from "./pages/ReportPage";
import InterrogationPage from "./pages/InterrogationPage";
import SettingsPage from "./pages/SettingsPage";
import DemoPage from "./pages/DemoPage";

function Router() {
  return (
    <Switch>
      {/* 警員端 */}
      <Route path="/" component={Home} />
      <Route path="/cases" component={CaseList} />
      <Route path="/cases/new" component={CaseCreate} />
      <Route path="/cases/:id" component={CaseDetail} />
      <Route path="/cases/:id/interrogation" component={InterrogationPage} />
      <Route path="/settings" component={SettingsPage} />
      {/* 示範頁面（公開，無需登入） */}
      <Route path="/demo" component={DemoPage} />
      {/* 報案人端（公開，無需登入） */}
      <Route path="/report/:token" component={ReportPage} />
      <Route path="/404" component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
