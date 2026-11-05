import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { lazy } from 'react';
import { RouteLoadBoundary } from './RouteLoadBoundary';

afterEach(cleanup);
describe('route chunk loading', () => {
  it('announces a pending import and displays the resolved page', async () => {
    let resolve!: (value: {default: () => React.ReactNode}) => void;
    const Page = lazy(() => new Promise<{default: () => React.ReactNode}>(r => { resolve = r; }));
    render(<RouteLoadBoundary route="/results"><Page /></RouteLoadBoundary>);
    expect(screen.getByRole('status')).toHaveTextContent('Sayfa yükleniyor…');
    resolve({default: () => <h1>Sonuçlar</h1>});
    expect(await screen.findByRole('heading')).toHaveTextContent('Sonuçlar');
  });
  it('offers an explicit reload and home after import rejection, without automatic retry', async () => {
    const imported = vi.fn(() => Promise.reject(new Error('missing chunk')));
    const Page = lazy(imported);
    const reload = vi.fn();
    const silence = vi.spyOn(console, 'error').mockImplementation(() => {});
    const view = render(<RouteLoadBoundary route="/results" reload={reload}><Page /></RouteLoadBoundary>);
    expect(await screen.findByRole('alert')).toHaveTextContent('Sayfa yüklenemedi');
    expect(screen.getByRole('link', {name:'Ana sayfaya dön'})).toHaveAttribute('href', '/');
    expect(reload).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', {name:'Sayfayı yeniden yükle'}));
    expect(reload).toHaveBeenCalledTimes(1);
    expect(imported).toHaveBeenCalledTimes(1);
    view.rerender(<RouteLoadBoundary route="/student/dashboard"><h1>Öğrenci</h1></RouteLoadBoundary>);
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.getByRole('heading')).toHaveTextContent('Öğrenci');
    silence.mockRestore();
  });
});
