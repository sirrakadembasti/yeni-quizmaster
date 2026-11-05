import { describe, it, expect } from 'vitest';
import { ApiError, isRetryableError } from './http-error';
describe('offline retry boundaries',()=>{
 it.each([400,401,403,404,409])('does not queue permanent HTTP %s failures',status=>expect(isRetryableError(new ApiError('Rejected',status))).toBe(false));
 it.each([408,429,500,503])('allows retry for transient HTTP %s failures',status=>expect(isRetryableError(new ApiError('Retry',status))).toBe(true));
 it('allows retry for a lost network connection',()=>expect(isRetryableError(new TypeError('Failed to fetch'))).toBe(true));
});
