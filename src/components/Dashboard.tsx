import React, { useState, useEffect } from 'react';
import { FileUpload } from './FileUpload';
import { DataPreview } from './DataPreview';
import { PropertyGroup } from './PropertyGroup';
import { RiskDistributionBar } from './RiskDistributionBar';
import { MetricCard } from './MetricCard';
import { LeaseTimeline } from './LeaseTimeline';
import { DelinquencyList } from './DelinquencyList';
import { LocationInsights } from './LocationInsights';
import { TenantData, TenantInsight } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { 
  Loader2, History, Building2, AlertTriangle, Users, TrendingUp, 
  ArrowUpRight, FileX, Upload, FileCheck, Eye, Brain, Bug, 
  ChevronDown, ChevronUp, DollarSign, Clock, AlertCircle,
  ArrowUpDown, Search, ChevronRight, Sparkles, ExternalLink
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';

type SortField = 'property' | 'units' | 'score' | 'risk' | 'delinquency';
type SortOrder = 'asc' | 'desc';

type DelinquencySortField = 'tenant' | 'property' | 'amount' | 'aging';

export function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();

  // Debug function - you can call this from browser console
  (window as any).debugSupabase = async () => {
    console.log("🔍 DEBUG - Testing Supabase connection...");
    console.log("🔍 DEBUG - Current user:", user?.id);
    
    try {
      const { data } = await supabase
        .from("tenant_insights_v2")
        .select("*");
      
      console.log("🔍 DEBUG - All insights:", data?.length || 0);
      console.log("🔍 DEBUG - Raw data:", data);
      
      if (data && data.length > 0) {
        console.log("🔍 DEBUG - User IDs:", [...new Set(data.map(d => d.user_id))]);
        console.log("🔍 DEBUG - Sample insight:", data[0]);
      }
    } catch (e) {
      console.error("🔍 DEBUG - Error:", e);
    }
  };

  // Add error boundary for React errors
  React.useEffect(() => {
    const handleError = (error: ErrorEvent) => {
      console.error("🚨 React Error:", error.error);
    };
    
    window.addEventListener('error', handleError);
    return () => window.removeEventListener('error', handleError);
  }, []);
  const [files, setFiles] = useState<{ [key: string]: File }>({});
  const [mergedData, setMergedData] = useState<TenantData[]>([]);
  const [insights, setInsights] = useState<TenantInsight[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [showSavedInsights, setShowSavedInsights] = useState<boolean>(false);
  const [showUploadSection, setShowUploadSection] = useState<boolean>(true);
  const [showPreview, setShowPreview] = useState<boolean>(false);
  const [generatingProgress, setGeneratingProgress] = useState<number>(0);
  const [requestData, setRequestData] = useState<string | null>(null);
  const [showDebugPanel, setShowDebugPanel] = useState<boolean>(false);
  const [debugData, setDebugData] = useState<{
    allTenants: TenantData[];
    sampledTenants: TenantData[];
  } | null>(null);
  const [expandedProperties, setExpandedProperties] = useState<Set<string>>(new Set());
  const [allExpanded, setAllExpanded] = useState(true);
  const [selectedProperty, setSelectedProperty] = useState<string | null>(null);
  // const [selectedTenant, setSelectedTenant] = useState<TenantInsight | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'location' | 'delinquency' | 'leases'>('overview');
  const [propertySortField, setPropertySortField] = useState<SortField>('property');
  const [propertySortOrder, setPropertySortOrder] = useState<SortOrder>('asc');
  const [delinquencySortField, setDelinquencySortField] = useState<DelinquencySortField>('amount');
  const [delinquencySortOrder, setDelinquencySortOrder] = useState<SortOrder>('desc');
  const [searchQuery, setSearchQuery] = useState('');
  const [renewalFilter, setRenewalFilter] = useState<'all' | 'renew' | 'do_not_renew'>('all');
  const [analysisResults, setAnalysisResults] = useState<{
    totalRows: number;
    unchangedRows: number;
    changedRows: number;
    changes: Array<{
      tenant: string;
      property: string;
      unit: string;
      changes: Record<string, { old: any; new: any }>;
    }>;
  } | null>(null);
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

const propertyLatLng = {
  "The Villas at Park Terrace - 301 Walkertown Ave Winston Salem, NC 27105": {
    latitude: 36.1170555787963, 
    longitude: -80.20638809515557,
  },
  "Villas at Park Terrace - 301 Walkertown Ave Winston-Salem, NC 27105": {
    latitude: 36.1170555787963, 
    longitude: -80.20638809515557,
  },
  "High Meadow Apartments - 5625 Farm Pond Ln, Charlotte, NC 28212": {
    latitude: 35.1827,
    longitude: -80.7414,
  },
};

const propertyMeta: Record<string, { city: string; state: string; postalCode?: string; defaultBeds?: number; defaultBaths?: number }> = {
  "The Villas at Park Terrace - 301 Walkertown Ave Winston Salem, NC 27105": {
    city: "Winston-Salem",
    state: "NC",
    postalCode: "27105",
    defaultBeds: 2,
    defaultBaths: 1,
  },
  "Villas at Park Terrace - 301 Walkertown Ave Winston-Salem, NC 27105": {
    city: "Winston-Salem",
    state: "NC",
    postalCode: "27105",
    defaultBeds: 2,
    defaultBaths: 1,
  },
  "High Meadow Apartments - 5625 Farm Pond Ln, Charlotte, NC 28212": {
    city: "Charlotte",
    state: "NC",
    postalCode: "28212",
    defaultBeds: 2,
    defaultBaths: 1,
  },
  // add more properties here as you go…
};

const API_BASE = "https://zv54onyhgk.execute-api.us-west-1.amazonaws.com/prod";

const [jobSummary, setJobSummary] = useState<{
  total: number;
  new: number;
  changed: number;
  unchanged: number;
} | null>(null);

const [syncing, setSyncing] = useState(false);
const [syncMessage, setSyncMessage] = useState<string | null>(null);
const [syncStarted, setSyncStarted] = useState(false);
const [estimatedProgress, setEstimatedProgress] = useState(0);
const [estimatedTimeRemaining, setEstimatedTimeRemaining] = useState<number | null>(null);

// ------- GMAIL OAUTH INTEGRATION SECTION -------
  // const FUNCTIONS_BASE = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`;
const POLLER_URL = import.meta.env.VITE_POLLER_URL; // set to your Lambda Function URL


const [gmailConnecting, setGmailConnecting] = useState(false);
const [gmailConnected, setGmailConnected] = useState<boolean>(false);
const [gmailEmail, setGmailEmail] = useState<string | null>(null);

// on page load, detect the callback redirect (?gmail=connected) and show status
useEffect(() => {
  const qs = new URLSearchParams(window.location.search);
  if (qs.get("gmail") === "connected") {
    setGmailConnected(true);
    // optional: read an email you stashed in localStorage or fetch from your own status endpoint
    const lastEmail = localStorage.getItem("gmailConnectedEmail");
    if (lastEmail) setGmailEmail(lastEmail);
    // clean the URL
    qs.delete("gmail");
    const url = `${window.location.pathname}${qs.toString() ? "?" + qs.toString() : ""}`;
    window.history.replaceState({}, "", url);
  }
}, []);

const connectGmail = async () => {
  if (!user?.id) {
    setError("Please log in first.");
    return;
  }

  setGmailConnecting(true);
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error("You must be signed in to connect Gmail.");

    const { data, error } = await supabase.functions.invoke("oauth-google-start", {
      body: { uid: user.id },
    });

    if (error) {
      // Try to read the response body from the error (supabase-js exposes .context)
      // @ts-ignore
      const ctxText = typeof error.context?.text === "function" ? await error.context.text() : "";
      console.error("oauth-google-start error:", error, ctxText);
      throw new Error(error.message || ctxText || "Edge function failed");
    }

    if (!data?.ok) {
      // The function returned 200 with an error payload
      const msg = data?.error || "oauth-google-start returned ok:false";
      console.error("oauth-google-start payload:", data);
      setError(msg);
      return;
    }

    const redirect = data?.url ?? data?.authUrl;
    if (!redirect) throw new Error("No auth URL returned from oauth-google-start");

    // Open OAuth in popup window instead of redirecting the main page
    const popup = window.open(
      redirect,
      'gmail-oauth',
      'width=500,height=600,scrollbars=yes,resizable=yes'
    );

    if (!popup) {
      throw new Error("Popup blocked. Please allow popups for this site.");
    }

    // Listen for popup completion using message event instead of checking popup.closed
    // This avoids COOP (Cross-Origin-Opener-Policy) issues
    let checkClosedInterval: NodeJS.Timeout | null = null;
    
    const messageHandler = (event: MessageEvent) => {
      // Security: Verify message origin
      if (event.origin !== window.location.origin) return;
      
      // Handle different message types
      if (event.data?.type === 'GMAIL_CONNECTED') {
        if (checkClosedInterval) clearInterval(checkClosedInterval);
        // ✅ Let the popup close itself to avoid COOP errors
        window.removeEventListener('message', messageHandler);
        
        setGmailConnected(true);
        setGmailEmail(event.data.email);
        setGmailConnecting(false);
        
        // Generate insights after Gmail connection
        generateInsightsAfterGmailConnection();
      } else if (event.data?.type === 'GMAIL_ERROR') {
        if (checkClosedInterval) clearInterval(checkClosedInterval);
        // ✅ Let the popup close itself to avoid COOP errors
        window.removeEventListener('message', messageHandler);
        
        setError(event.data.error || 'Gmail connection failed');
        setGmailConnecting(false);
      } else if (event.data?.type === 'gmail-oauth-complete') {
        // Legacy support - just check status
        if (checkClosedInterval) clearInterval(checkClosedInterval);
        window.removeEventListener('message', messageHandler);
        setGmailConnecting(false);
        checkGmailStatus();
      }
    };
    
    window.addEventListener('message', messageHandler);
    
    // Fallback: Try checking popup.closed but wrap in try-catch to suppress COOP warnings
    checkClosedInterval = setInterval(() => {
      try {
        if (popup.closed) {
          clearInterval(checkClosedInterval!);
          window.removeEventListener('message', messageHandler);
          setGmailConnecting(false);
          checkGmailStatus();
        }
      } catch (e) {
        // Suppress COOP errors - they're expected and harmless
      }
    }, 1000);
    
    // Cleanup after 2 minutes
    setTimeout(() => {
      if (checkClosedInterval) clearInterval(checkClosedInterval);
      window.removeEventListener('message', messageHandler);
      setGmailConnecting(false);
      checkGmailStatus();
    }, 120000);


  } catch (e: any) {
    console.error(e);
    setError(e?.message || "Failed to start Gmail connect");
    setGmailConnecting(false);
  }
};

const checkGmailStatus = async () => {
  if (!user?.id) return;

  try {
    const { data, error } = await supabase.functions.invoke("gmail-status", {
      body: { userId: user.id }
    });

    if (error) {
      console.error("gmail-status error:", error);
      // Don't throw on error - just assume not connected
      setGmailConnected(false);
      setGmailEmail(null);
      return;
    }

    if (data?.connected) {
      setGmailConnected(true);
      setGmailEmail(data.email);
    } else {
      setGmailConnected(false);
      setGmailEmail(null);
    }
  } catch (e) {
    console.error("gmail-status failed:", e);
    // Don't throw on error - just assume not connected
    setGmailConnected(false);
    setGmailEmail(null);
  }
};

const startInsightPolling = () => {
  if (!user?.id) return;

  console.log("Starting insight polling...");
  setSyncMessage("Processing your data...");
  setEstimatedProgress(0);
  
  const startTime = Date.now();
  
  // Estimate: ~150 tenants, ~3 min avg processing time (based on actual Lambda logs)
  // Progress simulation: logarithmic curve to feel natural
  const progressInterval = setInterval(() => {
    const elapsed = (Date.now() - startTime) / 1000; // seconds
    
    // Logarithmic progress: fast at first, slows down near completion
    // Reaches ~90% at 180 seconds (3 min), never hits 100% until real data arrives
    const progress = Math.min(90, Math.log(elapsed + 1) * 17);
    setEstimatedProgress(progress);
    
    // Estimate time remaining based on actual processing time
    const estimatedTotal = 180; // 3 minutes average (based on Lambda logs)
    const remaining = Math.max(0, estimatedTotal - elapsed);
    setEstimatedTimeRemaining(Math.ceil(remaining));
  }, 500);

  // Debug: Check what's actually in the database
  const debugCheck = async () => {
    try {
      const { data: allData } = await supabase
        .from("tenant_insights_v2")
        .select("*");
      
      console.log("DEBUG - All insights in database:", allData?.length || 0);
      console.log("DEBUG - All data:", allData);
      
      if (allData && allData.length > 0) {
        console.log("DEBUG - User IDs in database:", allData.map(d => d.user_id));
        console.log("DEBUG - Current user ID:", user.id);
      }
    } catch (e) {
      console.error("DEBUG - Error checking all data:", e);
    }
  };
  
  debugCheck();

  // Poll every 3 seconds indefinitely until insights are found
  let pollCount = 0;
  
  const pollInterval = setInterval(async () => {
    pollCount++;
    
    try {
      console.log(`Polling attempt ${pollCount} for user:`, user.id);
      console.log("🔍 DEBUG - User object:", user);
      console.log("🔍 DEBUG - User ID type:", typeof user.id);
      
      const { data, error } = await supabase
        .from("tenant_insights_v2")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })

      if (error) {
        console.error("Error polling insights:", error);
        setSyncMessage(`Error: ${error.message}`);
        clearInterval(progressInterval);
        return;
      }

      console.log(`Poll ${pollCount} - Found ${data?.length || 0} insights for user ${user.id}`);
      console.log("Raw data:", data);
      
      // Enhanced debugging
      if (data && data.length > 0) {
        console.log("🔍 DETAILED DEBUG - First insight object:", JSON.stringify(data[0], null, 2));
        console.log("🔍 DETAILED DEBUG - tenant_score specifically:", data[0]?.tenant_score);
        console.log("🔍 DETAILED DEBUG - Is tenant_score null?", data[0]?.tenant_score === null);
        console.log("🔍 DETAILED DEBUG - Is tenant_score undefined?", data[0]?.tenant_score === undefined);
        console.log("🔍 DETAILED DEBUG - tenant_score type:", typeof data[0]?.tenant_score);
      } else {
        console.log("🔍 DEBUG - No insights found in tenant_insights_v2 for user:", user.id);
        console.log("🔍 DEBUG - This means either:");
        console.log("  1. No data exists in tenant_insights_v2 for this user");
        console.log("  2. Wrong user ID");
        console.log("  3. Data exists but in different table");
        
        // Let's check if there's ANY data in the table
        console.log("🔍 DEBUG - Checking if ANY data exists in tenant_insights_v2...");
        const { data: anyData, error: anyError } = await supabase
          .from("tenant_insights_v2")
          .select("user_id, tenant_score, created_at")
          .limit(5);
        
        if (anyError) {
          console.log("🔍 DEBUG - Error checking for any data:", anyError);
        } else {
          console.log("🔍 DEBUG - Found data in tenant_insights_v2:", anyData);
          console.log("🔍 DEBUG - User IDs in table:", anyData?.map(d => d.user_id));
        }
      }

      if (data && data.length > 0) {
        // Found insights! Update the UI
        const formatted = data.map((i: any) => ({
          ...i,
          // Keep tenant_score as is - InsightCard will use tenant_score directly
        }));
        
        console.log("🔍 DEBUG - Raw data from Supabase:", data[0]);
        console.log("🔍 DEBUG - tenant_score value:", data[0]?.tenant_score);
        console.log("🔍 DEBUG - tenant_score type:", typeof data[0]?.tenant_score);
        console.log("🔍 DEBUG - All fields in data[0]:", Object.keys(data[0]));
        console.log("🔍 DEBUG - Formatted data:", formatted[0]);
        console.log("🔍 DEBUG - tenant_score value:", formatted[0]?.tenant_score);
        
        // DEBUG: Log unique property names to help configure propertyLatLng
        const uniqueProperties = [...new Set(data.map((i: any) => i.property))];
        console.log("📍 DEBUG - Unique property names in your data:", uniqueProperties);
        console.log("📍 DEBUG - You need to add these property names to propertyLatLng in Dashboard.tsx");
        
        // Calculate job summary by comparing with existing insights
        const existingTenantKeys = new Set(insights.map(i => 
          `${i.property}-${i.unit}-${i.tenant_name}`.toLowerCase()
        ));
        
        let newCount = 0;
        let unchangedCount = 0;
        
        formatted.forEach((insight: any) => {
          const key = `${insight.property}-${insight.unit}-${insight.tenant_name}`.toLowerCase();
          if (existingTenantKeys.has(key)) {
            unchangedCount++;
          } else {
            newCount++;
          }
        });
        
        setInsights(formatted);
        setEstimatedProgress(100);
        setSyncMessage("✅ Insights loaded successfully!");
        setSyncing(false);
        
        // Set accurate job summary
        setJobSummary({
          total: data.length,
          new: newCount,
          changed: 0, // We don't track changes between syncs yet
          unchanged: unchangedCount,
        });
        
        console.log("✅ Insights loaded from Supabase:", formatted.length);
        clearInterval(pollInterval);
        clearInterval(progressInterval);
        
        // Reset progress after 2 seconds
        setTimeout(() => {
          setEstimatedProgress(0);
          setEstimatedTimeRemaining(null);
        }, 2000);
        
        return;
      }

      // No insights yet, continue polling
      setSyncMessage("Processing tenants...");
      
    } catch (error) {
      console.error("Error in insight polling:", error);
      setSyncMessage("Error checking for insights");
      clearInterval(pollInterval);
      clearInterval(progressInterval);
      setSyncing(false);
    }
  }, 3000);

  // Clean up interval if component unmounts
  return () => {
    clearInterval(pollInterval);
    clearInterval(progressInterval);
  };
};

const generateInsightsAfterGmailConnection = async () => {
  if (!user?.id) return;

  try {
    console.log("Gmail connected successfully!");
    setSyncMessage("✅ Gmail connected! You can now sync to generate insights.");
    
    // Don't automatically start polling - let user manually sync when ready
    
  } catch (e) {
    console.error("Error in generateInsightsAfterGmailConnection:", e);
    setError("Failed to complete Gmail connection");
  }
};
  
const syncNow = async () => {
  if (!user?.id) {
    setError("Please log in first.");
    return;
  }

  setSyncing(true);
  setSyncStarted(true);
  setSyncMessage("Starting Gmail sync...");
  setInsights([]); // Clear existing insights when starting sync

  try {
    const res = await fetch(POLLER_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: user.id }),
    });

    if (!res.ok) throw new Error("Poller returned error");

    // ✅ Immediately show success to user
    setSyncMessage("Processing your data...");

    // 🔄 Start polling Supabase for results instead of Lambda
    startInsightPolling();
    
  } catch (e: any) {
    console.error("syncNow error:", e);
    setError(e.message || "Failed to trigger sync");
    setSyncing(false);
    setSyncStarted(false);
  }
};

useEffect(() => {
  (async () => {
    if (!user?.id) return;

    try {
      const { data, error } = await supabase.functions.invoke("gmail-status", {
        body: { userId: user.id }
      });

      if (error) {
        console.error("gmail-status error:", error);
        return;
      }

      if (data?.connected) {
        setGmailConnected(true);
        setGmailEmail(data.email);
      } else {
        setGmailConnected(false);
        setGmailEmail(null);
      }
    } catch (e) {
      console.error("gmail-status failed:", e);
    }
  })();
}, [user?.id]);

// ✅ Load insights on page load - DON'T show them until after sync
useEffect(() => {
  if (!user?.id) return;

  console.log("Loading insights on page load for user:", user.id);

  (async () => {
    try {
      // First, let's see what's actually in the database
      const { data: allData } = await supabase
        .from("tenant_insights_v2")
        .select("*");
      
      console.log("🔍 DEBUG - All insights in database:", allData?.length || 0);
      if (allData && allData.length > 0) {
        console.log("🔍 DEBUG - Sample insight:", allData[0]);
        console.log("🔍 DEBUG - All user IDs:", [...new Set(allData.map(d => d.user_id))]);
      }

      // Now try to get insights for current user
      const { data, error } = await supabase
        .from("tenant_insights_v2")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("❌ Failed to fetch tenant_insights:", error);
        return;
      }

      console.log("🔍 DEBUG - Found insights for current user:", data?.length || 0);
      console.log("🔍 DEBUG - Current user ID:", user.id);

      if (data && data.length > 0) {
        console.log("✅ Loading insights into UI:", data.length);
        console.log("🔍 DEBUG - Sample insight structure:", data[0]);
        
        try {
          const formatted = data.map((i: any) => ({
            ...i,
            score: typeof i.tenant_score === "number" ? i.tenant_score : 0,
          }));
          
          console.log("🔍 DEBUG - Raw Supabase data:", data[0]);
          console.log("🔍 DEBUG - tenant_score from DB:", data[0]?.tenant_score);
          console.log("🔍 DEBUG - Formatted insights:", formatted[0]);
          console.log("🔍 DEBUG - score after formatting:", formatted[0]?.score);
          
          // DEBUG: Log unique property names to help configure propertyLatLng
          const uniqueProperties = [...new Set(data.map((i: any) => i.property))];
          console.log("📍 DEBUG - Unique property names in your data:", uniqueProperties);
          console.log("📍 DEBUG - You need to add these property names to propertyLatLng in Dashboard.tsx");
          
          // Only set insights if sync hasn't started (i.e., showing cached data)
          // If sync started, don't show old data
          if (!syncStarted) {
            setInsights(formatted);
            
            setJobSummary({
              total: data.length,
              new: 0, // No change_type column in tenant_insights_v2
              changed: 0, // No change_type column in tenant_insights_v2
              unchanged: data.length, // All insights are current
            });
          }
          
          console.log("✅ Successfully loaded insights into UI");
        } catch (error) {
          console.error("❌ Error processing insights data:", error);
          console.error("❌ Problematic data:", data[0]);
        }
      } else {
        console.log("⚠️ No insights found for current user");
      }
    } catch (e) {
      console.error("❌ Error loading insights:", e);
    }
  })();
}, [user?.id, syncStarted]);

// Real-time subscription for new insights
useEffect(() => {
  if (!user?.id) return;

  console.log("Setting up real-time subscription for insights...");
  
  const subscription = supabase
    .channel('tenant_insights_changes')
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'tenant_insights_v2',
        filter: `user_id=eq.${user.id}`
      },
      (payload) => {
        console.log('New insight received:', payload);
        setSyncMessage("✅ New insights received!");
        
        // Refresh insights from database
        supabase
          .from("tenant_insights_v2")
          .select("*")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(5)
          .then(({ data, error }) => {
            if (error) {
              console.error("Error refreshing insights:", error);
              return;
            }
            
            if (data) {
              const formatted = data.map((i: any) => ({
                ...i,
                score: typeof i.tenant_score === "number" ? i.tenant_score : 0,
              }));
              
              setInsights(formatted);
              setJobSummary({
                total: data.length,
                new: 0, // No change_type column in tenant_insights_v2
                changed: 0, // No change_type column in tenant_insights_v2
                unchanged: data.length, // All insights are current
              });
              
              console.log("✅ Insights updated via real-time subscription");
            }
          });
      }
    )
    .subscribe();

  return () => {
    console.log("Cleaning up real-time subscription");
    subscription.unsubscribe();
  };
}, [user?.id]);

// ------- GMAIL OAUTH INTEGRATION SECTION -------
  
const pollForResults = async (job_id: string | null, accountIdForJob: string | null) => {
  const maxAttempts = 60;
  const intervalMs = 5000;

  const params = new URLSearchParams();

  if (job_id && job_id !== "null") {
    params.set("job_id", job_id);
  } else {
    params.set("action", "latest");
  }

  if (accountIdForJob) params.set("account_id", accountIdForJob);

  const url = `${API_BASE}/get_results?${params.toString()}`;
  console.log("POLL URL:", url);

  let attempts = 0;

  while (attempts < maxAttempts) {
    let res: Response;
    try {
      res = await fetch(url, { headers: { Accept: "application/json" } });
    } catch (e) {
      console.error("❌ POLL fetch failed (network/CORS):", e, "POLL URL:", url);
      throw e;
    }

    const payloadText = await res.text();
    console.log("Poll raw:", payloadText);

    let payload: any;
    try {
      payload = JSON.parse(payloadText);
    } catch (e) {
      console.error("❌ Poll JSON parse failed:", e, payloadText);
      throw new Error("Poll did not return valid JSON");
    }

    if (res.status === 200 && payload?.status === "complete" && Array.isArray(payload.results)) {
      return payload;
    }

    if (res.status === 202 || payload?.status === "processing") {
      await new Promise(r => setTimeout(r, intervalMs));
      attempts++;
      continue;
    }

    await new Promise(r => setTimeout(r, intervalMs));
    attempts++;
  }

  throw new Error("Polling timed out");
};
  //POLLING HELP

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isGenerating && generatingProgress < 95) {
      interval = setInterval(() => {
        setGeneratingProgress(prev => {
          const increment = Math.random() * 15;
          const newProgress = prev + increment;
          return newProgress > 95 ? 95 : newProgress;
        });
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isGenerating, generatingProgress]);

  useEffect(() => {
    if (insights.length > 0) {
      const properties = insights.map(insight => insight.property);
      setExpandedProperties(new Set(properties));
      setAllExpanded(true);
    }
  }, [insights]);

  const handleFileSelect = (newFiles: { [key: string]: File }) => {
    if (newFiles.combined) {
      setFiles({ combined: newFiles.combined });
    } else {
      const { combined, ...existingFiles } = files;
      setFiles({ ...existingFiles, ...newFiles });
    }
    setError(null);
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const base64String = reader.result as string;
        const base64Content = base64String.split(',')[1];
        resolve(base64Content);
      };
      reader.onerror = (error) => reject(error);
    });
  };

type SavedRun = {
  job_id: string;
  s3_key: string;
  last_modified: string; // ISO string
  size: number;          // bytes
};

const [savedRuns, setSavedRuns] = useState<SavedRun[]>([]);
  // const [loadingSaved, setLoadingSaved] = useState(false);
const [showSavedRunsList, setShowSavedRunsList] = useState(false);

const loadSavedRun = async (jobId: string, accountId: string) => {
  const params = new URLSearchParams();
  params.set("job_id", jobId);
  params.set("account_id", accountId);
  params.set("nowait", "1"); // tell Lambda to NOT wait/poll S3

  const url = `${API_BASE}/get_results?${params.toString()}`;
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  const text = await res.text();

  let payload: any;
  try {
    payload = JSON.parse(text);
  } catch (e) {
    throw new Error(`Failed to parse get_results payload: ${text}`);
  }

  if (res.status === 200 && payload?.status === "complete" && Array.isArray(payload.results)) {
    return payload.results as any[]; // your insight shape
  }

  // If for some reason the run isn't present (should be rare), fall back to polling:
  if (res.status === 202 || payload?.status === "processing") {
    return await pollForResults(jobId, accountId);
  }

  throw new Error(`Unexpected response loading saved run: ${text}`);
};
  
const fetchSavedInsights = async () => {
  if (!user?.id) {
    setError("Please log in to view saved insights");
    return;
  }

  setLoading(true);
  setError(null);
  setShowSavedInsights(true);
  setShowUploadSection(false);
  setMergedData([]);
  setInsights([]);
  setShowPreview(false);
  setGeneratingProgress(0);
  setRequestData(null);
  setDebugData(null);

  try {
    // 1) list saved runs for this account
    const params = new URLSearchParams();
    params.set("action", "list");
    params.set("account_id", user.id);

    const url = `${API_BASE}/get_results?${params.toString()}`;
    const res = await fetch(url, { headers: { Accept: "application/json" } });
    const text = await res.text();

    let payload: any;
    try {
      payload = JSON.parse(text);
    } catch (e) {
      throw new Error(`Failed to parse list payload: ${text}`);
    }

    if (res.status !== 200 || !payload?.items || !Array.isArray(payload.items)) {
      throw new Error(`List failed: ${text}`);
    }

    const items: SavedRun[] = payload.items;
    setSavedRuns(items);

    if (!items.length) {
      setError("No previous insights found for your account");
      return;
    }

    // Show the list of saved runs instead of auto-loading
    setShowSavedRunsList(true);
  } catch (err: any) {
    console.error("Error fetching saved insights from S3:", err);
    setError(err?.message || "Error fetching saved insights");
    setInsights([]);
  } finally {
    setLoading(false);
  }
};

  const mergeFiles = async () => {
    if (files.combined) {
      if (!files.combined) {
        setError('Please upload the combined report file');
        return;
      }
    } else {
      if (!files.delinquency || !files.rentRoll || !files.directory) {
        setError('Please upload all three files or a combined report file');
        return;
      }
    }
  
    setLoading(true);
    setError(null);
    setShowSavedInsights(false);
    setInsights([]);
    setShowPreview(false);
    setGeneratingProgress(0);
    setRequestData(null);
    setDebugData(null);
    setAnalysisResults(null);
  
    try {
      // ----------- FIX: GET THE SESSION FIRST ------------
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setError('You must be logged in to process files');
        setLoading(false);
        return;
      }
      // ---------------------------------------------------
  
      let base64Data;
      if (files.combined) {
        base64Data = {
          combined: await fileToBase64(files.combined)
        };
      } else {
        base64Data = {
          delinquency: await fileToBase64(files.delinquency),
          rent_roll: await fileToBase64(files.rentRoll),
          directory: await fileToBase64(files.directory)
        };
      }
  
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/merge-data`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${anonKey}`
        },
        body: JSON.stringify(base64Data),
      });
  
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
  
      const data = await response.json();
  
      // Analyze data changes before setting merged data
      await analyzeDataChanges(data);
  
      setMergedData(data);
    } catch (error) {
      console.error('Error merging files:', error);
      setError(error instanceof Error ? error.message : 'Error merging files');
      setMergedData([]);
    } finally {
      setLoading(false);
    }
  };


  const analyzeDataChanges = async (newData: TenantData[]) => {
    if (!user) return;

    try {
      console.log('Starting data analysis...');
      
      // Fetch existing tenant insights from database
      const { data: existingInsights, error } = await supabase
        .from('tenant_insights_v2')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(5);

      if (error) {
        console.error('Error fetching existing insights:', error);
        return;
      }

      console.log(`Found ${existingInsights?.length || 0} existing insights`);
      
      if (!existingInsights || existingInsights.length === 0) {
        console.log('No existing data to compare against');
        setAnalysisResults({
          totalRows: newData.length,
          unchangedRows: 0,
          changedRows: newData.length,
          changes: []
        });
        return;
      }

      // Create a map of existing data for quick lookup
      const existingDataMap = new Map();
      existingInsights.forEach(insight => {
        const key = `${insight.property}-${insight.unit}-${insight.tenant_name}`;
        existingDataMap.set(key, {
          rent_amount: insight.rent_amount,
          delinquent_rent: insight.delinquent_rent,
          past_due: insight.past_due,
          aging_30: insight.aging_30,
          aging_60: insight.aging_60,
          aging_90: insight.aging_90,
          aging_over_90: insight.aging_over_90,
          total_balance: insight.total_balance,
          delinquency_notes: insight.delinquency_notes
        });
      });

      const changes: Array<{
        tenant: string;
        property: string;
        unit: string;
        changes: Record<string, { old: any; new: any }>;
      }> = [];

      let unchangedCount = 0;
      let changedCount = 0;

      // Compare each new row with existing data
      newData.forEach(newRow => {
        const key = `${newRow.property}-${newRow.unit}-${newRow.tenant}`;
        const existingRow = existingDataMap.get(key);

        if (!existingRow) {
          // New tenant - count as changed
          changedCount++;
          console.log(`New tenant found: ${newRow.tenant} at ${newRow.property} - ${newRow.unit}`);
          return;
        }

        // Compare relevant fields
        const fieldsToCompare = {
          rent_amount: newRow.rentAmount || 0,
          delinquent_rent: newRow.delinquentRent || 0,
          past_due: newRow.pastDue || 0,
          aging_30: newRow.aging30 || 0,
          aging_60: newRow.aging60 || 0,
          aging_90: newRow.aging90 || 0,
          aging_over_90: newRow.agingOver90 || 0,
          total_balance: (newRow.pastDue || 0) + (newRow.delinquentRent || 0),
          delinquency_notes: newRow.delinquencyNotes || ''
        };

        const rowChanges: Record<string, { old: any; new: any }> = {};
        let hasChanges = false;

        // Check each field for changes
        Object.entries(fieldsToCompare).forEach(([field, newValue]) => {
          const oldValue = existingRow[field];
          
          // Handle numeric comparisons with tolerance for floating point
          if (typeof newValue === 'number' && typeof oldValue === 'number') {
            if (Math.abs(newValue - oldValue) > 0.01) {
              rowChanges[field] = { old: oldValue, new: newValue };
              hasChanges = true;
            }
          } else if (String(newValue).trim() !== String(oldValue).trim()) {
            rowChanges[field] = { old: oldValue, new: newValue };
            hasChanges = true;
          }
        });

        if (hasChanges) {
          changes.push({
            tenant: newRow.tenant,
            property: newRow.property,
            unit: newRow.unit,
            changes: rowChanges
          });
          changedCount++;
          console.log(`Changes detected for ${newRow.tenant}:`, rowChanges);
        } else {
          unchangedCount++;
          console.log(`No changes for ${newRow.tenant} - skipping`);
        }
      });

      const results = {
        totalRows: newData.length,
        unchangedRows: unchangedCount,
        changedRows: changedCount,
        changes
      };

      console.log('Analysis Results:', results);
      setAnalysisResults(results);

      // Log summary
      console.log(`Data Analysis Complete:
        - Total rows processed: ${results.totalRows}
        - Unchanged rows (skipped): ${results.unchangedRows}
        - Changed rows (kept): ${results.changedRows}
        - Detailed changes: ${results.changes.length} records`);

    } catch (error) {
      console.error('Error analyzing data changes:', error);
    }
  };

  /*
  const generateInsights = async () => {
    if (!mergedData.length) {
      setError('Please merge files first');
      return;
    }

    if (!user) {
      setError('Please log in to generate insights');
      return;
    }

    setIsGenerating(true);
    setError(null);
    setShowSavedInsights(false);
    setShowUploadSection(false);
    setShowPreview(false);
    setGeneratingProgress(0);
    
    try {
      setDebugData({
        allTenants: mergedData,
        sampledTenants: mergedData
      });

      const requestBody = { 
        tenants: mergedData,
        user_id: user.id
      };
      
      setRequestData(JSON.stringify(requestBody, null, 2));

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-insights`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabase.supabaseKey}`
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      setGeneratingProgress(100);
      setTimeout(() => {
        // Check if this is debug data from Lambda
        if (data.debug && data.rawLambdaResponse) {
          // Display raw JSON for testing
          alert('Raw Lambda Response:\n\n' + JSON.stringify(data.rawLambdaResponse, null, 2));
          console.log('Raw Lambda Response:', data.rawLambdaResponse);
          console.log('Request Payload:', data.requestPayload);
          setInsights([]);
        } else {
          setInsights(data);
        }
        setGeneratingProgress(0);
        setRequestData(null);
        setIsGenerating(false);
      }, 500);
    } catch (error) {
      console.error('Error generating insights:', error);
      setError(error instanceof Error ? error.message : 'Error generating insights');
      setInsights([]);
      setIsGenerating(false);
    }
  };
*/
  // NEW
  const generateInsights = async () => {
    if (!mergedData.length) {
      setError('Please merge files first');
      return;
    }
    if (!user) {
      setError('Please log in to generate insights');
      return;
    }
  
    setIsGenerating(true);
    setError(null);
    setShowSavedInsights(false);
    setShowUploadSection(false);
    setShowPreview(false);
    setGeneratingProgress(0);
  
    try {
      setDebugData({
        allTenants: mergedData,
        sampledTenants: mergedData
      });
  
      // const requestBody = { 
      //   tenants: mergedData,
      //   user_id: user.id
      // };
      // setRequestData(JSON.stringify(requestBody, null, 2));

      
      // ----- NEW: Request Presigned S3 URL + job_id -----
      console.log('About to fetch presigned-upload-url');

      const resp = await fetch(
        "https://dy7d1mkqgd.execute-api.us-west-1.amazonaws.com/prod/presigned-upload-url",
        { 
          method: "POST", 
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ "accountId": user?.id })
        }
      );
      if (!resp.ok) throw new Error("Failed to get presigned S3 URL");
      //const { presigned_url, job_id } = await resp.json();

      console.log('Got presigned URL response:', resp);

      const text = await resp.text();
      console.log('Raw response text:', text);
      
      let data;
      try {
        data = JSON.parse(text);
        console.log('Parsed JSON:', data);
      } catch (e) {
        console.error('Failed to parse JSON!', e);
        setError('API did not return valid JSON: ' + text);
        setIsGenerating(false);
        return;
      }
      
      if (!data.presigned_url || !data.job_id) {
        console.error('Missing fields in API response:', data);
        setError('API response missing expected fields: ' + JSON.stringify(data));
        setIsGenerating(false);
        return;
      }
      
const { presigned_url, job_id, s3_key } = data;

// Prefer explicit account_id if presign ever returns it
let accountIdForJob: string | null =
  (data.account_id ?? data.accountId ?? null) as string | null;

// If presign returns a tenant-scoped key, extract it: tenant_jobs/{accountId}/{jobId}/input.json
if (!accountIdForJob && typeof s3_key === 'string' && s3_key.startsWith('tenant_jobs/')) {
  const parts = s3_key.split('/'); // ["tenant_jobs", maybeAccountIdOrJobId, maybeJobId, "input.json"]
  if (parts.length >= 4) accountIdForJob = parts[1]; // tenant-scoped
}

// FINAL FALLBACK: if still null, use the signed-in user id (often equals the account id)
if (!accountIdForJob && user?.id) {
  accountIdForJob = user.id;
}

const uploadResp = await fetch(presigned_url, {
  method: "PUT",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(mergedData),
});
if (!uploadResp.ok) {
  console.error("S3 upload failed:", uploadResp.status, await uploadResp.text());
  throw new Error(`Failed to upload input.json to S3 (status ${uploadResp.status})`);
}

console.log('Polling with job_id:', job_id, 'accountIdForJob:', accountIdForJob);
const results = await pollForResults(job_id, accountIdForJob);
      setGeneratingProgress(100);
  
      setTimeout(() => {
        if (results && Array.isArray(results.results)) {
          // Map tenant_score to score for frontend display
          const formattedInsights = results.results.map((insight: any) => ({
            ...insight,
            score: typeof insight.tenant_score === "number" ? insight.tenant_score : 0,
          }));
      
          setInsights(formattedInsights);
          setJobSummary(results.summary || null);   // ✅ capture summary
          setGeneratingProgress(0);
          setRequestData(null);
          setIsGenerating(false);
        } else {
          setError("Invalid response format");
          setInsights([]);
          setIsGenerating(false);
        }
      }, 500);


  
      // --- Old/Commented-Out Code (for reference) ---
      /*
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-insights`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${anonKey}`
        },
        body: JSON.stringify(requestBody),
      });
  
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
  
      const data = await response.json();
      setGeneratingProgress(100);
      setTimeout(() => {
        // Check if this is debug data from Lambda
        if (data.debug && data.rawLambdaResponse) {
          // Display raw JSON for testing
          alert('Raw Lambda Response:\n\n' + JSON.stringify(data.rawLambdaResponse, null, 2));
          console.log('Raw Lambda Response:', data.rawLambdaResponse);
          console.log('Request Payload:', data.requestPayload);
          setInsights([]);
        } else {
          setInsights(data);
        }
        setGeneratingProgress(0);
        setRequestData(null);
        setIsGenerating(false);
      }, 500);
      */
      // --- END Old Code ---
  
    } catch (error) {
      console.error('Error in generateInsights:', error);

      setError(error instanceof Error ? error.message : 'Error generating insights');
      setInsights([]);
      setIsGenerating(false);
    }
  };
  // ----- END NEW ----------
  
  const showUploadView = () => {
    setShowUploadSection(true);
    setShowSavedInsights(false);
    setMergedData([]);
    setInsights([]);
    setError(null);
    setShowPreview(false);
    setGeneratingProgress(0);
    setRequestData(null);
    setDebugData(null);
  };

  const togglePreview = () => {
    setShowPreview(!showPreview);
  };

  const toggleDebugPanel = () => {
    setShowDebugPanel(!showDebugPanel);
  };

  const toggleAllProperties = () => {
    if (allExpanded) {
      setExpandedProperties(new Set());
    } else {
      const properties = insights.map(insight => insight.property);
      setExpandedProperties(new Set(properties));
    }
    setAllExpanded(!allExpanded);
  };

  const toggleProperty = (property: string) => {
    const newExpanded = new Set(expandedProperties);
    if (newExpanded.has(property)) {
      newExpanded.delete(property);
    } else {
      newExpanded.add(property);
    }
    setExpandedProperties(newExpanded);
    setAllExpanded(newExpanded.size === Object.keys(propertyGroups).length);
  };

  const calculateOverallStats = () => {
    // Ensure insights is always treated as an array
    const insightsArray = Array.isArray(insights) ? insights : [];
    
    if (!insightsArray.length) return null;

    const totalRevenue = insightsArray.reduce(
      (sum, insight) => sum + (typeof insight.rent_amount === 'number'
        ? insight.rent_amount
        : Number(insight.rent_amount) || 0),
      0
    );
    
    const averageRent = insightsArray.length > 0
      ? totalRevenue / insightsArray.length
      : 0;


    const delinquentCount = insightsArray.filter(i => i.delinquent_rent > 0).length;
    const upcomingLeases = insightsArray.filter(i => {
      if (!i.lease_end_date) return false;
      const leaseEnd = new Date(i.lease_end_date);
      const thirtyDaysFromNow = new Date();
      thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
      return leaseEnd <= thirtyDaysFromNow;
    }).length;

    const turnoverRisks = {
      low: 0,
      medium: 0,
      high: 0
    };

    const delinquencyRisks = {
      low: 0,
      medium: 0,
      high: 0
    };

    insightsArray.forEach(insight => {
      const turnoverRisk = (insight.turnover_risk || 'low').toLowerCase() as 'low' | 'medium' | 'high';
      turnoverRisks[turnoverRisk]++;

      const delinquencyRisk = (insight.predicted_delinquency || 'low').toLowerCase() as 'low' | 'medium' | 'high';
      delinquencyRisks[delinquencyRisk]++;
    });

    return {
      turnoverRisks,
      delinquencyRisks,
      totalUnits: insightsArray.length,
      totalRevenue,
      averageRent,
      delinquentCount,
      upcomingLeases,
      highRiskCount: insightsArray.filter(i => (i.turnover_risk || '').toLowerCase() === 'high').length,
      retentionNeeded: insightsArray.filter(i => i.retention_outreach_needed).length,
      rentIncreaseOpportunities: insightsArray.filter(i => i.raise_rent_opportunity).length,
      averageScore: Math.round(
        insightsArray.reduce((sum, insight) => sum + insight.tenant_score, 0) / insightsArray.length
      )
    };
  };

  const handleTenantClick = (_tenant: TenantInsight) => {
        // setSelectedTenant(tenant);
  };

  const handlePropertySort = (field: SortField) => {
    if (propertySortField === field) {
      setPropertySortOrder(propertySortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setPropertySortField(field);
      setPropertySortOrder('asc');
    }
  };

  const filterAndSortProperties = () => {
    // Only apply renewal filter at Dashboard level, let PropertyGroup handle search
    const filteredGroups = Object.entries(propertyGroups).reduce((acc, [property, insights]) => {
      const matchingInsights = insights.filter(insight => {
        // Only apply renewal filter here (search is handled by PropertyGroup)
        if (renewalFilter !== 'all') {
          const renewal = (insight.renewal_recommendation || '').toLowerCase().replace(/\s+/g, '_');
          if (renewalFilter === 'renew' && renewal !== 'renew') return false;
          if (renewalFilter === 'do_not_renew' && renewal !== 'do_not_renew') return false;
        }
        
        return true;
      });
      
      // Always include properties, even if search would filter all their tenants
      // PropertyGroup will handle the search filtering
      if (matchingInsights.length > 0) {
        acc[property] = matchingInsights;
      }
      return acc;
    }, {} as Record<string, TenantInsight[]>);

    // Then sort the filtered properties
    return Object.entries(filteredGroups).sort((a, b) => {
      const [propA, insightsA] = a;
      const [propB, insightsB] = b;
      
      const compareValue = (valA: any, valB: any) => {
        if (propertySortOrder === 'asc') {
          return valA > valB ? 1 : -1;
        }
        return valA < valB ? 1 : -1;
      };

      switch (propertySortField) {
        case 'property':
          return compareValue(propA, propB);
        case 'units':
          return compareValue(insightsA.length, insightsB.length);
        case 'score':
          const avgScoreA = insightsA.reduce((sum, i) => sum + i.tenant_score, 0) / insightsA.length;
          const avgScoreB = insightsB.reduce((sum, i) => sum + i.tenant_score, 0) / insightsB.length;
          return compareValue(avgScoreA, avgScoreB);
        case 'risk':
          const riskCountA = insightsA.filter(i => (i.turnover_risk || '').toLowerCase() === 'high').length;
          const riskCountB = insightsB.filter(i => (i.turnover_risk || '').toLowerCase() === 'high').length;
          return compareValue(riskCountA, riskCountB);
        case 'delinquency':
          const delinqCountA = insightsA.filter(i => i.high_delinquency_alert).length;
          const delinqCountB = insightsB.filter(i => i.high_delinquency_alert).length;
          return compareValue(delinqCountA, delinqCountB);
        default:
          return 0;
      }
    });
  };

  const getSortIcon = (field: SortField | DelinquencySortField, currentField: string, order: SortOrder) => {
    if (field !== currentField) {
      return <ArrowUpDown className="w-4 h-4 text-gray-400" />;
    }
    return order === 'asc' ? 
      <ChevronUp className="w-4 h-4 text-[#3F6B28]" /> : 
      <ChevronDown className="w-4 h-4 text-[#3F6B28]" />;
  };

  const stats = calculateOverallStats();
  const propertyGroups = (Array.isArray(insights) ? insights : []).reduce((groups: { [key: string]: TenantInsight[]}, insight) => {
    if (!groups[insight.property]) {
      groups[insight.property] = [];
    }
    groups[insight.property].push(insight);
    return groups;
  }, {});

  const allFilesUploaded = Object.keys(files).length === 3;

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Core PMS Beta Banner */}
      <div className="mb-6 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-6">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Try Core PMS (Beta)</h3>
              <span className="px-2 py-0.5 text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 rounded">
                New
              </span>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
              Our new property management system with native data entry, lease management, and real-time insights. 
              No CSV upload required. Perfect for managing a single property.
            </p>
            <div className="flex flex-wrap gap-3">
              <button
                onClick={() => navigate('/core/dashboard')}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
              >
                <Building2 className="w-4 h-4" />
                Go to Core Dashboard
                <ExternalLink className="w-3 h-3" />
              </button>
              <button
                onClick={() => navigate('/core/properties')}
                className="flex items-center gap-2 px-4 py-2 border border-blue-600 text-blue-600 dark:text-blue-400 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors text-sm font-medium"
              >
                Properties
              </button>
              <button
                onClick={() => navigate('/core/units')}
                className="flex items-center gap-2 px-4 py-2 border border-blue-600 text-blue-600 dark:text-blue-400 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors text-sm font-medium"
              >
                Units
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="mb-8">
        {/* Buttons Row */}
        <div className="flex flex-wrap gap-4 mb-4">
          <button
            onClick={showUploadView}
            className="px-4 py-2 bg-[#3F6B28] text-white rounded-lg hover:bg-[#345A22] disabled:opacity-50 disabled:hover:bg-[#3F6B28] flex items-center gap-2"
          >
            <Upload className="w-5 h-5" />
            <span>Upload New Files</span>
          </button>
          <button
            onClick={fetchSavedInsights}
            disabled={loading}
            className="px-4 py-2 bg-[#3F6B28] text-white rounded-lg hover:bg-[#345A22] disabled:opacity-50 disabled:hover:bg-[#3F6B28] flex items-center gap-2"
          >
            <History className="w-5 h-5" />
            <span>View Saved Insights</span>
          </button>
          <button
            onClick={connectGmail}
            disabled={gmailConnecting || !user}
            className="px-4 py-2 bg-[#3F6B28] text-white rounded-lg hover:bg-[#345A22] disabled:opacity-50 flex items-center gap-2"
          >
            {gmailConnecting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Users className="w-5 h-5" />}
            <span>
              {gmailConnected ? (gmailEmail ? `Gmail Connected (${gmailEmail})` : "Gmail Connected") : "Connect Gmail"}
            </span>
          </button>
        
          {/* Sync Now Button */}
          {gmailConnected && (
            <button
              onClick={syncNow}
              disabled={syncing}
              className={`px-4 py-2 rounded-lg flex items-center gap-2 ${
                syncing
                  ? "bg-gray-500 cursor-not-allowed"
                  : "bg-gray-800 hover:bg-gray-700 text-white"
              }`}
            >
              <Clock className="w-5 h-5" />
              <span>{syncing ? "Syncing..." : "Sync Now"}</span>
            </button>
          )}
          
          {import.meta.env.DEV && (
            <button
              onClick={toggleDebugPanel}
              className="px-4 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-700 flex items-center gap-2"
            >
              <Bug className="w-5 h-5" />
              <span>Toggle Debug Panel</span>
            </button>
          )}
        </div>

        {/* Progress Bar - Full Width Under All Buttons */}
        {syncing && estimatedProgress > 0 && (
          <div className="w-full bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-base font-medium text-gray-700 dark:text-gray-300">
                {syncMessage}
              </span>
              {estimatedTimeRemaining !== null && estimatedTimeRemaining > 0 && (
                <span className="text-sm text-gray-600 dark:text-gray-400 font-medium">
                  ~{Math.floor(estimatedTimeRemaining / 60)}m {estimatedTimeRemaining % 60}s remaining
                </span>
              )}
            </div>
            <div className="w-full h-4 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden mb-2">
              <div 
                className="h-full bg-gradient-to-r from-blue-500 to-green-500 transition-all duration-500 ease-out shadow-sm"
                style={{ width: `${estimatedProgress}%` }}
              />
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-400 font-medium">
              {Math.round(estimatedProgress)}% complete
            </div>
          </div>
        )}
        
        {!syncing && syncMessage && (
          <div className="w-full bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
            <div className="text-sm font-medium text-blue-700 dark:text-blue-300">
              {syncMessage}
            </div>
          </div>
        )}
      </div>

      {showUploadSection && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 mb-8">
          <h2 className="text-xl font-semibold text-[#3F6B28] dark:text-green-400 mb-6">Upload Files</h2>
          <div className="grid grid-cols-1 gap-6 mb-8">
            <FileUpload
              onFilesSelected={handleFileSelect}
              fileType="combined"
              label="Upload Combined Report CSV"
              optional={!files.combined}
            />
            <div className="text-center text-sm text-gray-500 dark:text-gray-400">- OR -</div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <FileUpload
                onFilesSelected={handleFileSelect}
                fileType="delinquency"
                label="Upload Delinquency CSV"
                optional={!!files.combined}
              />
              <FileUpload
                onFilesSelected={handleFileSelect}
                fileType="rentRoll"
                label="Upload Rent Roll CSV"
                optional={!!files.combined}
              />
              <FileUpload
                onFilesSelected={handleFileSelect}
                fileType="directory"
                label="Upload Tenant Directory CSV"
                optional={!!files.combined}
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-4 pt-4 border-t border-gray-200 dark:border-gray-700">
            <div className="flex-1">
              <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                <FileCheck className="w-5 h-5 text-[#3F6B28] dark:text-green-400" />
                <span>
                  {files.combined 
                    ? "Combined report file uploaded" 
                    : `${Object.keys(files).length}/3 files uploaded`}
                </span>
              </div>
            </div>
            <div className="flex gap-4">
              <button
                onClick={mergeFiles}
                disabled={loading || (!files.combined && !allFilesUploaded)}
                className="px-6 py-2 bg-[#3F6B28] text-white rounded-lg hover:bg-[#345A22] disabled:opacity-50 disabled:hover:bg-[#3F6B28] flex items-center gap-2 transition-colors"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>Processing...</span>
                  </>
                ) : (
                  <>
                    <ArrowUpRight className="w-5 h-5" />
                    <span>Process Data</span>
                  </>
                )}
              </button>
              {mergedData.length > 0 && (
                <>
                  <button
                    onClick={togglePreview}
                    className="px-4 py-2 text-[#3F6B28] dark:text-green-400 border border-[#3F6B28] dark:border-green-400 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2 transition-colors"
                  >
                    <Eye className="w-5 h-5" />
                    <span>{showPreview ? 'Hide Preview' : 'Show Preview'}</span>
                  </button>
                  <button
                    onClick={generateInsights}
                    disabled={isGenerating}
                    className="px-6 py-2 bg-[#3F6B28] text-white rounded-lg hover:bg-[#345A22] disabled:opacity-50 disabled:hover:bg-[#3F6B28] flex items-center gap-2 transition-colors"
                  >
                    {isGenerating ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        <span>Generating...</span>
                      </>
                    ) : (
                      <>
                        <TrendingUp className="w-5 h-5" />
                        <span>Generate Insights</span>
                      </>
                    )}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Data Analysis Results */}
      {analysisResults && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 mb-8">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
              <Search className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Data Analysis Results</h3>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
              <div className="text-2xl font-bold text-gray-900 dark:text-white">
                {analysisResults.totalRows}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">Total Rows</div>
            </div>
            <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4">
              <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                {analysisResults.unchangedRows}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">Unchanged (Skipped)</div>
            </div>
            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
              <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                {analysisResults.changedRows}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">Changed (Kept)</div>
            </div>
          </div>

          {analysisResults.changes.length > 0 && (
            <div>
              <h4 className="text-md font-semibold text-gray-900 dark:text-white mb-4">
                Detailed Changes ({analysisResults.changes.length} records)
              </h4>
              <div className="max-h-96 overflow-y-auto space-y-4">
                {analysisResults.changes.map((change, index) => (
                  <div key={index} className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 border border-gray-200 dark:border-gray-600">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <h5 className="font-medium text-gray-900 dark:text-white">
                          {change.tenant}
                        </h5>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          {change.property} - Unit {change.unit}
                        </p>
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        {Object.keys(change.changes).length} change{Object.keys(change.changes).length !== 1 ? 's' : ''}
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      {Object.entries(change.changes).map(([field, values]) => (
                        <div key={field} className="flex items-center justify-between text-sm">
                          <span className="font-medium text-gray-700 dark:text-gray-300 capitalize">
                            {field.replace(/_/g, ' ')}:
                          </span>
                          <div className="flex items-center gap-2">
                          <span className="text-red-600 dark:text-red-400">
                            {typeof values.old === 'number'
                              ? `$${values.old.toFixed(2)}`
                              : values.old || 'Empty'}
                          </span>
                          <span className="text-gray-400">→</span>
                          <span className="text-green-600 dark:text-green-400">
                            {typeof values.new === 'number'
                              ? `$${values.new.toFixed(2)}`
                              : values.new || 'Empty'}
                          </span>    
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {analysisResults.changes.length === 0 && analysisResults.unchangedRows > 0 && (
            <div className="text-center py-8">
              <div className="w-12 h-12 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center">
                  <div className="w-2 h-2 bg-white rounded-full"></div>
                </div>
              </div>
              <h4 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                No Changes Detected
              </h4>
              <p className="text-gray-600 dark:text-gray-400">
                All {analysisResults.unchangedRows} records match existing data exactly.
              </p>
            </div>
          )}
        </div>
      )}

      {error && (
        <div className="mb-8 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-400 flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 flex-shrink-0" />
          <p>{error}</p>
        </div>
      )}

      {isGenerating && generatingProgress > 0 && (
        <div className="mb-8 bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
          <div className="flex items-center gap-3 mb-4">
            <Brain className="w-6 h-6 text-[#3F6B28] dark:text-green-400 animate-pulse" />
            <h3 className="text-lg font-semibold text-[#3F6B28] dark:text-green-400">Generating Insights</h3>
          </div>
          <div className="space-y-4">
            <div className="h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
              <div 
                className="h-full bg-[#3F6B28] dark:bg-green-400 rounded-full transition-all duration-300"
                style={{ width: `${generatingProgress}%` }}
              />
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {generatingProgress < 30 && "Analyzing tenant data..."}
              {generatingProgress >= 30 && generatingProgress < 60 && "Calculating risk factors..."}
              {generatingProgress >= 60 && generatingProgress < 90 && "Generating recommendations..."}
              {generatingProgress >= 90 && "Finalizing insights..."}
            </p>
          </div>
        </div>
      )}

      {import.meta.env.DEV && showDebugPanel && debugData && (
        <div className="mb-8 bg-gray-900 rounded-lg shadow-lg p-6 text-white">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Bug className="w-5 h-5" />
            Debug Information
          </h3>
          
          <div className="space-y-6">
            <div>
              <h4 className="text-sm font-medium text-gray-400 mb-2">All Tenants ({debugData.allTenants.length})</h4>
              <div className="bg-gray-800 rounded-lg p-4 overflow-x-auto">
                <pre className="text-xs text-gray-300">
                  {JSON.stringify(debugData.allTenants.slice(0, 5).map(tenant => ({
                    property: tenant.property,
                    unit: tenant.unit,
                    tenant: tenant.tenant,
                    rentAmount: tenant.rentAmount,
                    delinquentRent: tenant.delinquentRent
                  })), null, 2)}
                </pre>
              </div>
            </div>

            <div>
              <h4 className="text-sm font-medium text-gray-400 mb-2">Sampled Random Tenants ({debugData.sampledTenants.length})</h4>
              <div className="bg-gray-800 rounded-lg p-4 overflow-x-auto">
                <pre className="text-xs text-gray-300">
                  {JSON.stringify(debugData.sampledTenants, null, 2)}
                </pre>
              </div>
            </div>
          </div>
        </div>
      )}

      {requestData && (
        <div className="mb-8 bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
          <h3 className="text-lg font-semibold text-[#3F6B28] dark:text-green-400 mb-4">API Request Data</h3>
          <pre className="bg-gray-50 dark:bg-gray-900 p-4 rounded-lg overflow-x-auto text-sm">
            {requestData}
          </pre>
        </div>
      )}

      {/* Saved Runs List View */}
      {showSavedRunsList && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold text-[#3F6B28] dark:text-green-400">
              Saved Insight Reports
            </h2>
            <button
              onClick={() => setShowSavedRunsList(false)}
              className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors"
            >
              Back to Dashboard
            </button>
          </div>

          {savedRuns.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-gray-500 dark:text-gray-400">
                <Brain className="w-16 h-16 mx-auto mb-4 opacity-50" />
                <h3 className="text-lg font-medium mb-2">No Saved Reports</h3>
                <p>Generate your first tenant insights to see them here.</p>
              </div>
            </div>
          ) : (
            <div className="grid gap-4">
              {savedRuns.map((report) => (
                <div
                  key={report.job_id}
                  className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6 hover:shadow-md transition-shadow cursor-pointer"
                  onClick={async () => {
                    setShowSavedRunsList(false);
                    const results = await loadSavedRun(report.job_id, user?.id || '');
                    const formattedInsights = results.map((insight: any) => ({
                      ...insight,
                      score: typeof insight.tenant_score === 'number' ? insight.tenant_score : 0,
                    }));
                    setInsights(formattedInsights);
                  }}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-[#3F6B28] bg-opacity-10 dark:bg-opacity-20 rounded-lg flex items-center justify-center">
                        <Brain className="w-6 h-6 text-[#3F6B28] dark:text-green-400" />
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                          Insight Report
                        </h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          Generated on {new Date(report.last_modified).toLocaleDateString('en-US', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <ChevronRight className="w-5 h-5 text-gray-400" />
                    </div>
                  </div>
                  
                  <div className="mt-4 flex items-center gap-6 text-sm text-gray-600 dark:text-gray-400">
                    <div className="flex items-center gap-2">
                      <Users className="w-4 h-4" />
                      <span>Job ID: {report.job_id.slice(0, 8)}...</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4" />
                      <span>{formatDistanceToNow(new Date(report.last_modified), { addSuffix: true })}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {error && showSavedInsights && !insights.length && (
        <div className="flex flex-col items-center justify-center py-12 bg-white dark:bg-gray-800 rounded-lg shadow-sm">
          <FileX className="w-16 h-16 text-gray-400 mb-4" />
          <h3 className="text-xl font-medium text-[#3F6B28] dark:text-green-400 mb-2">No Previous Insights</h3>
          <p className="text-gray-600 dark:text-gray-400">Upload your files and generate new insights to get started.</p>
        </div>
      )}

      {showPreview && mergedData.length > 0 && !showSavedInsights && (
        <div className="mb-8">
          <h2 className="text-xl font-semibold mb-4 text-[#3F6B28] dark:text-green-400">Data Preview</h2>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
            <DataPreview data={mergedData} />
          </div>
        </div>
      )}
      {jobSummary && (
        <div className="mb-8 bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-[#3F6B28] dark:text-green-400 mb-4">
            Latest Sync Summary
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-2xl font-bold">{jobSummary.total}</p>
              <p className="text-sm text-gray-600 dark:text-gray-400">Total Tenants</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-green-600">{jobSummary.new}</p>
              <p className="text-sm">New</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-blue-600">{jobSummary.changed}</p>
              <p className="text-sm">Changed</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-600">{jobSummary.unchanged}</p>
              <p className="text-sm">Unchanged</p>
            </div>
          </div>
        </div>
      )}
      {stats && !showSavedRunsList && (
        <div className="space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <MetricCard
              title="Total Revenue"
              value={`$${stats.totalRevenue.toLocaleString()}`}
              icon={<DollarSign className="w-6 h-6" />}
              color="green"
            />
            <MetricCard
              title="Average Rent"
              value={`$${Math.round(stats.averageRent).toLocaleString()}`}
              icon={<Building2 className="w-6 h-6" />}
              color="blue"
            />
            <MetricCard
              title="Delinquent Tenants"
              value={stats.delinquentCount}
              icon={<AlertCircle className="w-6 h-6" />}
              color="red"
            />
            <MetricCard
              title="Upcoming Leases"
              value={stats.upcomingLeases}
              icon={<Clock className="w-6 h-6" />}
              color="purple"
            />
          </div>

          <div className="border-b border-gray-200 dark:border-gray-700">
            <nav className="flex space-x-8">
              <button
                onClick={() => setActiveTab('overview')}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'overview'
                    ? 'border-havyn-primary text-havyn-primary dark:border-green-400 dark:text-green-400'
                    : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'
                }`}
              >
                Overview
              </button>
              <button
                onClick={() => setActiveTab('location')}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'location'
                    ? 'border-havyn-primary text-havyn-primary dark:border-green-400 dark:text-green-400'
                    : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'
                }`}
              >
                Location Insights
              </button>
              <button
                onClick={() => setActiveTab('delinquency')}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'delinquency'
                    ? 'border-havyn-primary text-havyn-primary dark:border-green-400 dark:text-green-400'
                    : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'
                }`}
              >
                Delinquency
              </button>
              <button
                onClick={() => setActiveTab('leases')}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'leases'
                    ? 'border-havyn-primary text-havyn-primary dark:border-green-400 dark:text-green-400'
                    : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'
                }`}
              >
                Lease Timeline
              </button>
            </nav>
          </div>
          
          <div className="mt-6">
            {activeTab === 'overview' && (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                  <RiskDistributionBar
                    data={stats.turnoverRisks}
                    title="Turnover Risk"
                    subtitle="Distribution by risk level"
                  />
                  <RiskDistributionBar
                    data={stats.delinquencyRisks}
                    title="Delinquency Risk"
                    subtitle="Distribution by risk level"
                  />
                </div>
          
                <div>
                  <div className="mb-6">
                    <div className="flex justify-between items-center mb-4">
                      <h2 className="text-xl font-semibold text-[#3F6B28] dark:text-green-400 whitespace-nowrap">
                        {showSavedInsights ? 'Saved Insights' : 'Property Insights'}
                      </h2>
                    </div>
          
                    {/* Combined Filters & Controls Section */}
                    <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-4 mb-4 border border-gray-200 dark:border-gray-700">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Filters</h3>
                        <button
                          onClick={() => {
                            setRenewalFilter('all');
                            setPropertySortField('property');
                            setPropertySortOrder('asc');
                          }}
                          className="text-xs text-[#3F6B28] dark:text-green-400 hover:underline"
                        >
                          Reset All Filters
                        </button>
                      </div>
                      
                      {/* Sort & Filter Controls Row */}
                      <div className="flex flex-wrap items-center gap-3">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handlePropertySort('score')}
                            className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md whitespace-nowrap"
                          >
                            Score {getSortIcon('score', propertySortField, propertySortOrder)}
                          </button>
                          <button
                            onClick={() => handlePropertySort('risk')}
                            className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md whitespace-nowrap"
                          >
                            Risk {getSortIcon('risk', propertySortField, propertySortOrder)}
                          </button>
                          <button
                            onClick={() => handlePropertySort('delinquency')}
                            className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md whitespace-nowrap"
                          >
                            Delinquency {getSortIcon('delinquency', propertySortField, propertySortOrder)}
                          </button>
                          
                          {/* Renewal Filter */}
                          <select
                            value={renewalFilter}
                            onChange={(e) => setRenewalFilter(e.target.value as any)}
                            className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-[#3F6B28]"
                          >
                            <option value="all">Renewal Status</option>
                            <option value="renew">Renew</option>
                            <option value="do_not_renew">Do Not Renew</option>
                          </select>
                        </div>
          
                        <div className="flex items-center gap-3 ml-auto">
                          <div className="relative">
                            <input
                              type="text"
                              placeholder="Search unit or tenant..."
                              value={searchQuery}
                              onChange={(e) => {
                                console.log("🔍 Dashboard search query changed:", e.target.value);
                                setSearchQuery(e.target.value);
                              }}
                              className="pl-10 pr-4 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-[#3F6B28] dark:focus:ring-green-400 w-64"
                            />
                            <Search className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
                          </div>
          
                          <select
                            value={selectedProperty || ''}
                            onChange={(e) => {
                              const value = e.target.value;
                              setSelectedProperty(value || null);
                              if (value) {
                                setExpandedProperties(new Set([value]));
                                setAllExpanded(false);
                              }
                            }}
                            className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-[#3F6B28] dark:focus:ring-green-400 min-w-[160px]"
                          >
                            <option value="">All Properties</option>
                            {Object.keys(propertyGroups).map(property => (
                              <option key={property} value={property}>{property}</option>
                            ))}
                          </select>
                          
                          <button
                            onClick={toggleAllProperties}
                            className="flex items-center gap-2 px-4 py-1.5 text-[#3F6B28] dark:text-green-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors whitespace-nowrap"
                          >
                            {allExpanded ? (
                              <>
                                <ChevronUp className="w-5 h-5" />
                                <span>Collapse All</span>
                              </>
                            ) : (
                              <>
                                <ChevronDown className="w-5 h-5" />
                                <span>Expand All</span>
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
          
                  <div className="space-y-4">
                    {(() => {
                      const filteredProps = filterAndSortProperties()
                        .filter(([property]) => !selectedProperty || property === selectedProperty);
                      
                      console.log("🔍 Dashboard rendering PropertyGroups with searchQuery:", searchQuery);
                      console.log("🔍 Number of properties to render:", filteredProps.length);
                      
                      return filteredProps.map(([property, propertyInsights]) => (
                        <PropertyGroup
                          key={property}
                          property={property}
                          insights={propertyInsights}
                          isExpanded={expandedProperties.has(property)}
                          onToggle={() => toggleProperty(property)}
                          searchQuery={searchQuery}
                          sortField={propertySortField === 'score' || propertySortField === 'risk' || propertySortField === 'delinquency' ? propertySortField : undefined}
                          sortOrder={propertySortOrder}
                        />
                      ));
                    })()}
                  </div>
                </div>
              </>
            )}
          
            {activeTab === 'location' && (
              <LocationInsights 
                insights={insights} 
                propertyLatLng={propertyLatLng}
                propertyMeta={propertyMeta}
                />
            )}
          
            {activeTab === 'delinquency' && (
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-xl font-semibold text-[#3F6B28] dark:text-green-400">Delinquency Management</h2>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        if (delinquencySortField === 'tenant') {
                          setDelinquencySortOrder(delinquencySortOrder === 'asc' ? 'desc' : 'asc');
                        } else {
                          setDelinquencySortField('tenant');
                          setDelinquencySortOrder('asc');
                        }
                      }}
                      className="flex items-center gap-1 px-3 py-1 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md"
                    >
                      Tenant {getSortIcon('tenant', delinquencySortField, delinquencySortOrder)}
                    </button>
                    <button
                      onClick={() => {
                        if (delinquencySortField === 'property') {
                          setDelinquencySortOrder(delinquencySortOrder === 'asc' ? 'desc' : 'asc');
                        } else {
                          setDelinquencySortField('property');
                          setDelinquencySortOrder('asc');
                        }
                      }}
                      className="flex items-center gap-1 px-3 py-1 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md"
                    >
                      Property {getSortIcon('property', delinquencySortField, delinquencySortOrder)}
                    </button>
                    <button
                      onClick={() => {
                        if (delinquencySortField === 'amount') {
                          setDelinquencySortOrder(delinquencySortOrder === 'asc' ? 'desc' : 'asc');
                        } else {
                          setDelinquencySortField('amount');
                          setDelinquencySortOrder('desc');
                        }
                      }}
                      className="flex items-center gap-1 px-3 py-1 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md"
                    >
                      Amount {getSortIcon('amount', delinquencySortField, delinquencySortOrder)}
                    </button>
                    <button
                      onClick={() => {
                        if (delinquencySortField === 'aging') {
                          setDelinquencySortOrder(delinquencySortOrder === 'asc' ? 'desc' : 'asc');
                        } else {
                          setDelinquencySortField('aging');
                          setDelinquencySortOrder('desc');
                        }
                      }}
                      className="flex items-center gap-1 px-3 py-1 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md"
                    >
                      Aging {getSortIcon('aging', delinquencySortField, delinquencySortOrder)}
                    </button>
                  </div>
                </div>
                <DelinquencyList
                  insights={insights}
                  onTenantClick={handleTenantClick}
                  sortField={delinquencySortField}
                  sortOrder={delinquencySortOrder}
                />
              </div>
            )}
          
            {activeTab === 'leases' && (
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
                <h2 className="text-xl font-semibold text-[#3F6B28] dark:text-green-400 mb-6">Lease Timeline</h2>
                <LeaseTimeline
                  insights={insights}
                  onTenantClick={handleTenantClick}
                />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}