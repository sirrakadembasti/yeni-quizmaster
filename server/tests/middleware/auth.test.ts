import { describe, it, expect, vi, beforeEach } from 'vitest';
import { requireAuth, requireRole, AuthRequest } from '../../middleware/auth';
import { storage } from '../../storage';
import { Response, NextFunction } from 'express';

// Mock storage
vi.mock('../../storage', () => ({
  storage: {
    getUser: vi.fn(),
  }
}));

describe('Auth Middleware', () => {
  let mockReq: Partial<AuthRequest>;
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    mockReq = {
      session: {} as any,
    };
    mockRes = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    };
    mockNext = vi.fn();
    vi.clearAllMocks();
  });

  describe('requireAuth', () => {
    it('should return 401 if session.userId is not present', async () => {
      await requireAuth(mockReq as AuthRequest, mockRes as Response, mockNext);
      
      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({ message: "Oturum açmanız gerekiyor." });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should return 401 if user is not found in storage', async () => {
      mockReq.session!.userId = 'non-existent-id';
      vi.mocked(storage.getUser).mockResolvedValue(undefined);

      await requireAuth(mockReq as AuthRequest, mockRes as Response, mockNext);

      expect(storage.getUser).toHaveBeenCalledWith('non-existent-id');
      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({ message: "Kullanıcı bulunamadı." });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should populate req.user and call next if user exists', async () => {
      mockReq.session!.userId = 'existing-id';
      const mockUser = { id: 'existing-id', username: 'testuser' };
      vi.mocked(storage.getUser).mockResolvedValue(mockUser as any);

      await requireAuth(mockReq as AuthRequest, mockRes as Response, mockNext);

      expect(mockReq.user).toEqual(mockUser);
      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
    });

    it('should handle internal errors gracefully', async () => {
      mockReq.session!.userId = 'error-id';
      vi.mocked(storage.getUser).mockRejectedValue(new Error('Database error'));

      await requireAuth(mockReq as AuthRequest, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({ message: "Dahili sunucu hatası." });
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  it('rejects sessions issued before password change', async () => {
    mockReq.session!.userId = 'user';
    vi.mocked(storage.getUser).mockResolvedValue({id:'user',sessionVersion:1} as any);
    await requireAuth(mockReq as AuthRequest,mockRes as Response,mockNext);
    expect(mockRes.status).toHaveBeenCalledWith(401);expect(mockNext).not.toHaveBeenCalled();
  });

  describe('requireRole', () => {
    it('should return 403 if req.user is undefined', () => {
      const middleware = requireRole(['admin']);
      middleware(mockReq as AuthRequest, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith({ message: "Bu işlemi yapmak için yetkiniz yok." });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should return 403 if user role is not in allowed roles', () => {
      mockReq.user = { id: 'user-id', role: 'student' } as any;
      const middleware = requireRole(['admin', 'teacher']);
      
      middleware(mockReq as AuthRequest, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith({ message: "Bu işlemi yapmak için yetkiniz yok." });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should call next if user role is in allowed roles', () => {
      mockReq.user = { id: 'user-id', role: 'teacher' } as any;
      const middleware = requireRole(['admin', 'teacher']);
      
      middleware(mockReq as AuthRequest, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
    });
  });
});
