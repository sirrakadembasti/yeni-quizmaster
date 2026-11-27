import { describe, it, expect, vi } from 'vitest';
import { respondToClassError } from '../../utils/class-errors';

function fakeResponse() {
  const res: any = { status: vi.fn(() => res), json: vi.fn(() => res) };
  return res;
}
const codeError = (code: string, message: string) => Object.assign(new Error(message), { code });

describe('respondToClassError', () => {
  it('hata kodunu hem message hem code alanından okur', () => {
    const a = fakeResponse();
    expect(respondToClassError(new Error('CLASS_EXISTS'), a)).toBe(true);
    expect(a.status).toHaveBeenCalledWith(400);
    const b = fakeResponse();
    expect(respondToClassError(codeError('CLASS_EXISTS', 'baska metin'), b)).toBe(true);
    expect(b.status).toHaveBeenCalledWith(400);
    expect(b.json).toHaveBeenCalledWith({ message: 'Bu isimde bir sınıf zaten mevcut.' });
  });

  it('CLASS_NOT_EMPTY için 409 ve hatanın kendi iletisini döndürür', () => {
    const res = fakeResponse();
    expect(respondToClassError(codeError('CLASS_NOT_EMPTY', 'Önce sınıfı boşaltın.'), res)).toBe(true);
    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith({ message: 'Önce sınıfı boşaltın.' });
  });

  it('bilinmeyen hatada false döner ve yanıt yazmaz', () => {
    const res = fakeResponse();
    expect(respondToClassError(new Error('baska'), res)).toBe(false);
    expect(res.status).not.toHaveBeenCalled();
  });
});
