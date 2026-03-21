import axios from 'axios';

const http = axios.create({ baseURL: (process.env.REACT_APP_API_URL || '') + '/api' });

http.interceptors.request.use(c => {
  const t = localStorage.getItem('cx_token');
  if (t) c.headers.Authorization = `Bearer ${t}`;
  return c;
});

http.interceptors.response.use(r => r, e => {
  if (e.response?.status === 401) {
    ['cx_token','cx_user','cx_tenant'].forEach(k => localStorage.removeItem(k));
    window.location.href = '/login';
  }
  return Promise.reject(e);
});

// Auth
export const apiRegister       = d  => http.post('/auth/register', d);
export const apiLogin          = d  => http.post('/auth/login', d);
export const apiMe             = () => http.get('/auth/me');
export const apiSaveAws        = d  => http.post('/auth/credentials/aws', d);
export const apiSaveGcp        = d  => http.post('/auth/credentials/gcp', d);
export const apiSaveAzure      = d  => http.post('/auth/credentials/azure', d);
export const apiRevokeCloud    = c  => http.delete(`/auth/credentials/revoke/${c}`);
export const apiInvite         = d  => http.post('/auth/invite', d);

// Dashboard
export const apiDashboard      = () => http.get('/dashboard/summary');

// Costs
export const apiAwsCosts       = () => http.get('/costs/aws');
export const apiGcpCosts       = () => http.get('/costs/gcp');
export const apiAzureCosts     = () => http.get('/costs/azure');

// Scanner
export const apiScanAws        = t  => http.get(`/scanner/aws?type=${t}`);
export const apiAnomalies      = () => http.get('/scanner/anomalies');
export const apiScanGcp        = () => http.get('/scanner/gcp');
export const apiScanAzure      = () => http.get('/scanner/azure');

// Alerts
export const apiGetAlerts      = () => http.get('/alerts/');
export const apiCreateAlert    = d  => http.post('/alerts/', d);
export const apiDeleteAlert    = id => http.delete(`/alerts/${id}`);
export const apiToggleAlert    = id => http.post(`/alerts/${id}/toggle`);

// Admin
export const apiAdminStats     = () => http.get('/admin/stats');
export const apiAdminTenants   = () => http.get('/admin/tenants');
export const apiAdminPlan      = (id,plan) => http.post(`/admin/tenants/${id}/plan`,{plan});
export const apiAdminToggle    = id => http.post(`/admin/tenants/${id}/toggle`);
export const apiAdminDelete    = id => http.delete(`/admin/tenants/${id}`);
export const apiAdminUsers     = () => http.get('/admin/users');

export default http;

// Recommendations
export const apiAllRecs        = ()  => http.get('/recommendations/');
export const apiAzureRecs      = ()  => http.get('/recommendations/azure');
export const apiAwsRecs        = ()  => http.get('/recommendations/aws');
export const apiGcpRecs        = ()  => http.get('/recommendations/gcp');

// Multi-cloud anomalies
export const apiAllAnomalies   = ()  => http.get('/scanner/anomalies/all');

// Azure scanner
export const apiScanAzureVMs   = ()  => http.get('/scanner/azure/vms');

// Plan
export const apiPlanStatus     = ()  => http.get('/dashboard/plan-status');

// Reports
export const apiDownloadReport = ()  => http.get('/reports/monthly', { responseType:'blob' });
export const apiReportSummary  = ()  => http.get('/reports/summary');

// Admin - resend verification
export const apiAdminResendVerification = (uid) => http.post(`/admin/resend-verification/${uid}`);

// Slack
export const apiSaveSlack   = d => http.post('/auth/credentials/slack', d);
export const apiTestSlack   = ()=> http.post('/auth/test-slack');
export const apiGcpScanVMs  = ()=> http.get('/scanner/gcp/vms');

// Payments
export const apiCreatePaymentLink = (d) => http.post('/payment/create-link', d);
