export const getToken  = () => localStorage.getItem('cx_token');
export const getUser   = () => JSON.parse(localStorage.getItem('cx_user')   || 'null');
export const getTenant = () => JSON.parse(localStorage.getItem('cx_tenant') || 'null');
export const isLoggedIn   = () => !!getToken();
export const isSuperAdmin = () => getUser()?.role === 'superadmin';

export const saveSession = ({token, user, tenant}) => {
  localStorage.setItem('cx_token',  token);
  localStorage.setItem('cx_user',   JSON.stringify(user));
  localStorage.setItem('cx_tenant', JSON.stringify(tenant));
};

export const clearSession = () =>
  ['cx_token','cx_user','cx_tenant'].forEach(k => localStorage.removeItem(k));

export const refreshTenant = async () => {
  const { apiMe }       = await import('./api');
  const { getToken }    = await import('./auth');
  const res = await apiMe();
  saveSession({ token: getToken(), user: res.data.user, tenant: res.data.tenant });
  return res.data.tenant;
};
