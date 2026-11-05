import helmet from 'helmet';

export function httpSecurity(httpsDeployment: boolean) {
  return helmet({
    crossOriginResourcePolicy: false,
    contentSecurityPolicy: {
      directives: { 'upgrade-insecure-requests': httpsDeployment ? [] : null },
    },
  });
}
