import { Switch, Route, useLocation } from "wouter";
import { useEffect } from "react";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/theme-provider";
import { PWAInstallProvider } from "@/hooks/use-pwa-install";
import { PWAInstallPrompt } from "@/components/pwa-install-prompt";
import { DeviceBlocker } from "@/components/device-blocker";

function ScrollToTop() {
  const [location] = useLocation();
  
  useEffect(() => {
    const hash = window.location.hash;
    
    if (hash) {
      const element = document.getElementById(hash.slice(1));
      if (element) {
        setTimeout(() => {
          element.scrollIntoView({ behavior: 'smooth' });
        }, 100);
        return;
      }
    }
    
    const html = document.documentElement;
    const originalScrollBehavior = html.style.scrollBehavior;
    html.style.scrollBehavior = 'auto';
    
    window.scrollTo(0, 0);
    
    const timer = setTimeout(() => {
      html.style.scrollBehavior = originalScrollBehavior;
    }, 100);
    
    return () => clearTimeout(timer);
  }, [location]);
  
  return null;
}
import NotFound from "@/pages/not-found";
import Home from "@/pages/home";
import Pricing from "@/pages/pricing";
import Contact from "@/pages/contact";
import Guide from "@/pages/guide";
import Signup from "@/pages/signup";
import TenantLanding from "@/pages/tenant/landing";
import IdeasList from "@/pages/tenant/ideas/list";
import NewIdea from "@/pages/tenant/ideas/new";
import TrackIdea from "@/pages/tenant/ideas/track";
import IncidentsList from "@/pages/tenant/incidents/list";
import NewIncident from "@/pages/tenant/incidents/new";
import TrackIncident from "@/pages/tenant/incidents/track";
import MeetingsList from "@/pages/tenant/meetings/list";
import MeetingDetail from "@/pages/tenant/meetings/detail";
import AdminLogin from "@/pages/tenant/admin/login";
import AdminDashboard from "@/pages/tenant/admin/dashboard";
import AdminIdeas from "@/pages/tenant/admin/ideas";
import AdminIncidents from "@/pages/tenant/admin/incidents";
import AdminMeetings from "@/pages/tenant/admin/meetings";
import AdminBilling from "@/pages/tenant/admin/billing";
import AdminAssociations from "@/pages/tenant/admin/associations";
import AdminCommunes from "@/pages/tenant/admin/communes";
import AdminAdmins from "@/pages/tenant/admin/admins";
import AdminPhotos from "@/pages/tenant/admin/photos";
import AdminSettings from "@/pages/tenant/admin/settings";
import AdminElus from "@/pages/tenant/admin/elus";
import AdminDomains from "@/pages/tenant/admin/domains";
import AdminForgotPassword from "@/pages/tenant/admin/forgot-password";
import AdminResetPassword from "@/pages/tenant/admin/reset-password";
import ElusList from "@/pages/tenant/elus/list";
import EluProfile from "@/pages/tenant/elus/profile";
import MyContributions from "@/pages/tenant/my-contributions";
import ElectedOfficialSetupPassword from "@/pages/elus/setup-password";
import AssociationLanding from "@/pages/association/landing";
import AssociationLogin from "@/pages/association/login";
import AssociationDashboard from "@/pages/association/dashboard";
import AssociationAdminIdeas from "@/pages/association/admin/ideas";
import AssociationAdminIncidents from "@/pages/association/admin/incidents";
import AssociationAdminMeetings from "@/pages/association/admin/meetings";
import AssociationAdminBilling from "@/pages/association/admin/billing";
import AssociationAdminBureau from "@/pages/association/admin/bureau";
import AssociationAdminPhotos from "@/pages/association/admin/photos";
import AssociationAdminSettings from "@/pages/association/admin/settings";
import AssociationAdminDomains from "@/pages/association/admin/domains";
import AssociationIdeasList from "@/pages/association/ideas/list";
import AssociationNewIdea from "@/pages/association/ideas/new";
import AssociationIncidentsList from "@/pages/association/incidents/list";
import AssociationNewIncident from "@/pages/association/incidents/new";
import AssociationMeetingsList from "@/pages/association/meetings/list";
import AssociationMeetingDetail from "@/pages/association/meetings/detail";
import AssociationBureau from "@/pages/association/bureau";
import BureauMemberProfile from "@/pages/association/bureau/profile";
import Login from "@/pages/login";
import SuperadminLogin from "@/pages/superadmin/login";
import SuperadminDashboard from "@/pages/superadmin/dashboard";
import SuperadminTenants from "@/pages/superadmin/tenants";
import SuperadminTenantDetail from "@/pages/superadmin/tenant-detail";
import SuperadminLeads from "@/pages/superadmin/leads";
import SuperadminSubscriptions from "@/pages/superadmin/subscriptions";
import SuperadminPlans from "@/pages/superadmin/plans";
import SuperadminFeatures from "@/pages/superadmin/features";
import SuperadminProducts from "@/pages/superadmin/products";
import SuperadminAddons from "@/pages/superadmin/addons";
import SuperadminQuotes from "@/pages/superadmin/quotes";
import SuperadminInvoices from "@/pages/superadmin/invoices";
import SuperadminAdmins from "@/pages/superadmin/admins";
import SuperadminActivityTracking from "@/pages/superadmin/activity-tracking";
import SuperadminConfiguration from "@/pages/superadmin/configuration";
import SuperadminMandateOrders from "@/pages/superadmin/mandate-orders";
import SuperadminMandateInvoices from "@/pages/superadmin/mandate-invoices";
import SuperadminStripeBilling from "@/pages/superadmin/stripe-billing";
import SuperadminClientSubscriptions from "@/pages/superadmin/client-subscriptions";
import SuperadminBillingPipeline from "@/pages/superadmin/billing-pipeline";
import SuperadminOrders from "@/pages/superadmin/orders";
import SuperadminAllInvoices from "@/pages/superadmin/all-invoices";
import SuperadminAuditHistory from "@/pages/superadmin/audit-history";
import SuperadminDocumentFormats from "@/pages/superadmin/document-formats";
import SuperadminServiceCodes from "@/pages/superadmin/service-codes";
import SuperadminFunctions from "@/pages/superadmin/functions";
import SuperadminAccounting from "@/pages/superadmin/accounting";
import Subscribe from "@/pages/subscribe";
import SignupOptions from "@/pages/signup-options";
import SignupAccount from "@/pages/signup-account";
import PublicQuoteValidation from "@/pages/public-quote-validation";
import ProspectPortal from "@/pages/prospect-portal";
import SearchOrganizations from "@/pages/search-organizations";
import AdminSharing from "@/pages/admin/sharing";
import AssociationSharing from "@/pages/association-admin/sharing";
import RGPD from "@/pages/rgpd";
import MentionsLegales from "@/pages/mentions-legales";
import CGU from "@/pages/cgu";
import ChatPage from "@/pages/chat";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/recherche" component={SearchOrganizations} />
      <Route path="/pricing" component={Pricing} />
      <Route path="/subscribe" component={Subscribe} />
      <Route path="/subscribe/options" component={SignupOptions} />
      <Route path="/subscribe/account" component={SignupAccount} />
      <Route path="/contact" component={Contact} />
      <Route path="/guide" component={Guide} />
      <Route path="/signup" component={Signup} />
      <Route path="/login" component={Login} />
      <Route path="/rgpd" component={RGPD} />
      <Route path="/mentions-legales" component={MentionsLegales} />
      <Route path="/cgu" component={CGU} />
      <Route path="/elus/setup-password" component={ElectedOfficialSetupPassword} />
      <Route path="/q/:token" component={PublicQuoteValidation} />
      <Route path="/p/:token" component={ProspectPortal} />
      <Route path="/chat/:type/:token" component={ChatPage} />
      
      <Route path="/structures/:slug" component={TenantLanding} />
      <Route path="/structures/:slug/ideas" component={IdeasList} />
      <Route path="/structures/:slug/ideas/new" component={NewIdea} />
      <Route path="/structures/:slug/ideas/track/:token" component={TrackIdea} />
      <Route path="/structures/:slug/incidents" component={IncidentsList} />
      <Route path="/structures/:slug/incidents/new" component={NewIncident} />
      <Route path="/structures/:slug/incidents/track/:token" component={TrackIncident} />
      <Route path="/structures/:slug/meetings" component={MeetingsList} />
      <Route path="/structures/:slug/meetings/:id" component={MeetingDetail} />
      <Route path="/structures/:slug/elus" component={ElusList} />
      <Route path="/structures/:slug/elus/:id" component={EluProfile} />
      <Route path="/structures/:slug/mes-contributions" component={MyContributions} />
      
      <Route path="/structures/:slug/admin/login" component={AdminLogin} />
      <Route path="/structures/:slug/admin/forgot-password" component={AdminForgotPassword} />
      <Route path="/structures/:slug/admin/reset-password" component={AdminResetPassword} />
      <Route path="/structures/:slug/admin" component={AdminDashboard} />
      <Route path="/structures/:slug/admin/ideas" component={AdminIdeas} />
      <Route path="/structures/:slug/admin/incidents" component={AdminIncidents} />
      <Route path="/structures/:slug/admin/meetings" component={AdminMeetings} />
      <Route path="/structures/:slug/admin/billing" component={AdminBilling} />
      <Route path="/structures/:slug/admin/associations" component={AdminAssociations} />
      <Route path="/structures/:slug/admin/communes" component={AdminCommunes} />
      <Route path="/structures/:slug/admin/photos" component={AdminPhotos} />
      <Route path="/structures/:slug/admin/admins" component={AdminAdmins} />
      <Route path="/structures/:slug/admin/settings" component={AdminSettings} />
      <Route path="/structures/:slug/admin/elus" component={AdminElus} />
      <Route path="/structures/:slug/admin/domains" component={AdminDomains} />
      <Route path="/structures/:slug/admin/sharing" component={AdminSharing} />
      
      <Route path="/structures/:slug/:assocSlug/ideas" component={AssociationIdeasList} />
      <Route path="/structures/:slug/:assocSlug/ideas/new" component={AssociationNewIdea} />
      <Route path="/structures/:slug/:assocSlug/incidents" component={AssociationIncidentsList} />
      <Route path="/structures/:slug/:assocSlug/incidents/new" component={AssociationNewIncident} />
      <Route path="/structures/:slug/:assocSlug/meetings" component={AssociationMeetingsList} />
      <Route path="/structures/:slug/:assocSlug/meetings/:id" component={AssociationMeetingDetail} />
      <Route path="/structures/:slug/:assocSlug/bureau" component={AssociationBureau} />
      <Route path="/structures/:slug/:assocSlug/bureau/:id" component={BureauMemberProfile} />
      <Route path="/structures/:slug/:assocSlug" component={AssociationLanding} />
      <Route path="/structures/:slug/:assocSlug/login" component={AssociationLogin} />
      <Route path="/structures/:slug/:assocSlug/admin" component={AssociationDashboard} />
      <Route path="/structures/:slug/:assocSlug/admin/ideas" component={AssociationAdminIdeas} />
      <Route path="/structures/:slug/:assocSlug/admin/incidents" component={AssociationAdminIncidents} />
      <Route path="/structures/:slug/:assocSlug/admin/meetings" component={AssociationAdminMeetings} />
      <Route path="/structures/:slug/:assocSlug/admin/bureau" component={AssociationAdminBureau} />
      <Route path="/structures/:slug/:assocSlug/admin/domains" component={AssociationAdminDomains} />
      <Route path="/structures/:slug/:assocSlug/admin/photos" component={AssociationAdminPhotos} />
      <Route path="/structures/:slug/:assocSlug/admin/settings" component={AssociationAdminSettings} />
      <Route path="/structures/:slug/:assocSlug/admin/sharing" component={AssociationSharing} />
      
      <Route path="/backoffice/login" component={SuperadminLogin} />
      <Route path="/superadmin/login" component={SuperadminLogin} />
      <Route path="/superadmin" component={SuperadminDashboard} />
      <Route path="/superadmin/tenants" component={SuperadminTenants} />
      <Route path="/superadmin/tenants/:id" component={SuperadminTenantDetail} />
      <Route path="/superadmin/leads" component={SuperadminLeads} />
      <Route path="/superadmin/plans" component={SuperadminPlans} />
      <Route path="/superadmin/fonctionnalites" component={SuperadminFeatures} />
      <Route path="/superadmin/addons" component={SuperadminAddons} />
      <Route path="/superadmin/products" component={SuperadminProducts} />
      <Route path="/superadmin/subscriptions" component={SuperadminSubscriptions} />
      <Route path="/superadmin/quotes" component={SuperadminQuotes} />
      <Route path="/superadmin/invoices" component={SuperadminInvoices} />
      <Route path="/superadmin/mandate-orders" component={SuperadminMandateOrders} />
      <Route path="/superadmin/mandate-invoices" component={SuperadminMandateInvoices} />
      <Route path="/superadmin/stripe-billing" component={SuperadminStripeBilling} />
      <Route path="/superadmin/client-subscriptions" component={SuperadminClientSubscriptions} />
      <Route path="/superadmin/billing-pipeline" component={SuperadminBillingPipeline} />
      <Route path="/superadmin/orders" component={SuperadminOrders} />
      <Route path="/superadmin/all-invoices" component={SuperadminAllInvoices} />
      <Route path="/superadmin/admins" component={SuperadminAdmins} />
      <Route path="/superadmin/activity-tracking" component={SuperadminActivityTracking} />
      <Route path="/superadmin/configuration" component={SuperadminConfiguration} />
      <Route path="/superadmin/document-formats" component={SuperadminDocumentFormats} />
      <Route path="/superadmin/service-codes" component={SuperadminServiceCodes} />
      <Route path="/superadmin/functions" component={SuperadminFunctions} />
      <Route path="/superadmin/audit-history" component={SuperadminAuditHistory} />
      <Route path="/superadmin/accounting" component={SuperadminAccounting} />
      
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider defaultTheme="light" storageKey="voxpopulous-theme">
        <TooltipProvider>
          <PWAInstallProvider>
            <DeviceBlocker>
              <ScrollToTop />
              <Toaster />
              <Router />
              <PWAInstallPrompt />
            </DeviceBlocker>
          </PWAInstallProvider>
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
