import { Component, Suspense, type ReactNode } from 'react';
import { Link } from 'wouter';

type Props = { children: ReactNode; route: string; reload?: () => void };
class RouteErrorBoundary extends Component<Props, {failed:boolean}> {
  state = {failed:false};
  static getDerivedStateFromError() { return {failed:true}; }
  render() {
    if (!this.state.failed) return this.props.children;
    return <div role="alert" className="mx-auto max-w-lg space-y-4 p-8">
      <h1 className="text-xl font-semibold">Sayfa yüklenemedi</h1>
      <p>Bağlantınızı kontrol edip sayfayı yeniden yükleyebilirsiniz.</p>
      <button className="rounded border px-4 py-2" onClick={this.props.reload ?? (() => window.location.reload())}>Sayfayı yeniden yükle</button>
      <Link href="/" className="ml-4 underline">Ana sayfaya dön</Link>
    </div>;
  }
}
export function RouteLoadBoundary(props: Props) {
  return <RouteErrorBoundary key={props.route} {...props}>
    <Suspense fallback={<div role="status" className="p-8 text-center">Sayfa yükleniyor…</div>}>
      {props.children}
    </Suspense>
  </RouteErrorBoundary>;
}
